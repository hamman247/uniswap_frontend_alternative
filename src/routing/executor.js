/**
 * Route Executor — builds and submits transactions for the optimized route
 *
 * All swap legs are bundled into a SINGLE transaction via the Universal Router.
 * The Universal Router supports V2, V3, and V4 swaps in one execute() call.
 *
 * For chains without a Universal Router, falls back to the best available
 * single-version router.
 *
 * Explicitly sets EIP-1559 gas parameters to avoid MetaMask's inflated
 * default priority fee (2 gwei). Fetches the real priority fee from
 * the network and uses that instead.
 */
import { UNISWAP_V2, UNISWAP_V3, UNISWAP_V4, ERC20_ABI, getCurrentChainId, getGasConfig, getContracts, getWethAddress } from '../config/contracts.js';
import { NATIVE_ETH, WETH_ADDRESS, getRoutingAddress, isWrapUnwrap } from '../config/tokens.js';
import { feeManager } from '../fees/feeManager.js';

// ─── WETH ABI for wrap/unwrap ───
const WETH_ABI = [
    'function deposit() payable',
    'function withdraw(uint256 wad)',
];

// ─── Universal Router command IDs ───
const UR_COMMANDS = {
    V3_SWAP_EXACT_IN: 0x00,
    V2_SWAP_EXACT_IN: 0x08,
    WRAP_ETH: 0x0b,
    UNWRAP_WETH: 0x0c,
    V4_SWAP: 0x10,
};

// ─── V4 swap action IDs (from @uniswap/v4-sdk Actions enum) ───
const V4_ACTIONS = {
    SWAP_EXACT_IN_SINGLE: 0x06,
    SETTLE_ALL: 0x0c,
    TAKE_ALL: 0x0f,
};

/**
 * Build EIP-1559 gas overrides from live network data.
 */
async function buildGasOverrides(provider) {
    try {
        const latestBlock = await provider.getBlock('latest');
        const baseFee = latestBlock?.baseFeePerGas || 10_000_000_000n;

        let priorityFee;
        try {
            const feeHistory = await provider.send('eth_feeHistory', ['0x5', 'latest', [25]]);
            const rewards = (feeHistory.reward || [])
                .map(r => BigInt(r[0]))
                .filter(r => r > 0n);

            if (rewards.length > 0) {
                rewards.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
                priorityFee = rewards[Math.floor(rewards.length / 2)];
            }
        } catch {
            // eth_feeHistory may not be supported
        }

        if (!priorityFee) {
            const feeData = await provider.getFeeData();
            priorityFee = feeData.maxPriorityFeePerGas || 100_000_000n;
        }

        const { minTipWei, maxTipWei } = getGasConfig();
        priorityFee = priorityFee < minTipWei ? minTipWei : priorityFee > maxTipWei ? maxTipWei : priorityFee;

        const maxFeePerGas = baseFee + baseFee / 8n + priorityFee;

        console.log(
            `Gas: baseFee=${Number(baseFee) / 1e9}gwei, tip=${Number(priorityFee) / 1e9}gwei, maxFee=${Number(maxFeePerGas) / 1e9}gwei`
        );

        return { maxFeePerGas, maxPriorityFeePerGas: priorityFee };
    } catch (e) {
        console.warn('Failed to fetch gas params, letting wallet decide:', e.message);
        return {};
    }
}

/**
 * Execute a native ↔ wrapped native wrap or unwrap.
 */
export async function executeWrapUnwrap(signer, amount, isWrap, wethAddress) {
    const { ethers } = await import('ethers');
    const weth = new ethers.Contract(wethAddress, WETH_ABI, signer);
    const gasOverrides = await buildGasOverrides(signer.provider);

    if (isWrap) {
        console.log(`Wrapping ${Number(amount) / 1e18} native → WETH`);
        return weth.deposit({ value: amount, ...gasOverrides });
    } else {
        console.log(`Unwrapping ${Number(amount) / 1e18} WETH → native`);
        return weth.withdraw(amount, gasOverrides);
    }
}

/**
 * Execute the optimized route — bundles all legs into a single transaction.
 *
 * @param {import('ethers').Signer} signer — connected wallet signer
 * @param {object} routeResult — from optimizer
 * @param {object} tokenIn
 * @param {object} tokenOut
 * @param {number} slippageBps — slippage tolerance in bps (default 50 = 0.5%)
 * @param {number} deadlineMinutes — transaction deadline
 * @returns {Promise<Array<import('ethers').TransactionResponse>>}
 */
export async function executeRoute(signer, routeResult, tokenIn, tokenOut, slippageBps = 50, deadlineMinutes = 20) {
    const { ethers } = await import('ethers');

    // Check for wrap/unwrap — bypass pool routing entirely
    const chainId = getCurrentChainId();
    const wrapCheck = isWrapUnwrap(tokenIn, tokenOut, chainId);
    if (wrapCheck.isWrapUnwrap) {
        const tx = await executeWrapUnwrap(
            signer,
            routeResult.totalAmountIn,
            wrapCheck.isWrap,
            wrapCheck.wethAddress
        );
        return [tx];
    }

    const deadline = Math.floor(Date.now() / 1000) + deadlineMinutes * 60;
    const gasOverrides = await buildGasOverrides(signer.provider);
    const recipient = await signer.getAddress();
    const contracts = getContracts(chainId);
    const wethAddr = getWethAddress(chainId);

    // Determine the effective token addresses for routing
    const effectiveTokenIn = tokenIn.isNative ? wethAddr : tokenIn.address;
    const effectiveTokenOut = tokenOut.isNative ? wethAddr : tokenOut.address;

    // ─── Try Universal Router batching first ───
    const universalRouterAddr = contracts.v4UniversalRouter;
    if (universalRouterAddr) {
        return [await executeBatchedViaUniversalRouter(
            ethers, signer, routeResult, tokenIn, tokenOut,
            effectiveTokenIn, effectiveTokenOut, wethAddr,
            universalRouterAddr, recipient, slippageBps, deadline, gasOverrides
        )];
    }

    // ─── Fallback: use individual routers (for chains without Universal Router) ───
    return executeLegacy(
        ethers, signer, routeResult, tokenIn, tokenOut,
        effectiveTokenIn, effectiveTokenOut, recipient, slippageBps, deadline, gasOverrides
    );
}

/**
 * Execute all route legs in a SINGLE transaction via the Universal Router.
 *
 * The Universal Router accepts:
 *   execute(bytes commands, bytes[] inputs, uint256 deadline)
 *
 * Commands:
 *   0x00 = V3_SWAP_EXACT_IN
 *   0x08 = V2_SWAP_EXACT_IN
 *   0x0b = WRAP_ETH (if input is native)
 *   0x0c = UNWRAP_WETH (if output is native)
 */
async function executeBatchedViaUniversalRouter(
    ethers, signer, routeResult, tokenIn, tokenOut,
    effectiveTokenIn, effectiveTokenOut, wethAddr,
    universalRouterAddr, recipient, slippageBps, deadline, gasOverrides
) {
    const abiCoder = ethers.AbiCoder.defaultAbiCoder();
    const commands = [];
    const inputs = [];
    let totalEthValue = 0n;

    const ZERO_ADDR = '0x0000000000000000000000000000000000000000';

    // If input is native ETH, figure out how much needs to be wrapped for V2/V3
    // vs left as native ETH for V4 settlement
    if (tokenIn.isNative) {
        totalEthValue = routeResult.totalAmountIn;

        // Calculate how much goes to V2/V3 legs (needs WETH) vs V4 legs (native ETH)
        let v2v3Amount = 0n;
        for (const route of routeResult.routes) {
            const pool = route.pool.isMultiHop ? route.pool.leg1 : route.pool;
            const isV4Native = pool.version === 'V4' &&
                (pool.currency0?.toLowerCase() === ZERO_ADDR || pool.currency1?.toLowerCase() === ZERO_ADDR);
            if (!isV4Native) {
                v2v3Amount += route.amountIn;
            }
        }

        // Wrap only the V2/V3 portion to WETH; V4 portion stays as native ETH
        if (v2v3Amount > 0n) {
            commands.push(UR_COMMANDS.WRAP_ETH);
            inputs.push(abiCoder.encode(
                ['address', 'uint256'],
                [universalRouterAddr, v2v3Amount]
            ));
        }
    } else {
        // ERC-20 input: ensure approval for the Universal Router
        await ensureApproval(signer, tokenIn.address, universalRouterAddr, routeResult.totalAmountIn, gasOverrides);
    }

    // Encode each route leg as a Universal Router command
    for (const route of routeResult.routes) {
        const minAmountOut = route.amountOut - (route.amountOut * BigInt(slippageBps)) / 10000n;
        const version = route.pool.isMultiHop
            ? route.pool.leg1.version
            : route.pool.version;

        const payerIsUser = !tokenIn.isNative;
        const swapRecipient = tokenOut.isNative ? universalRouterAddr : recipient;

        if (version === 'V4') {
            // V4 swap via V4_SWAP command — uses pool's actual currencies from PoolKey
            const v4Input = encodeV4SwapCommand(
                ethers, abiCoder, route, tokenIn, tokenOut,
                minAmountOut, swapRecipient
            );
            commands.push(UR_COMMANDS.V4_SWAP);
            inputs.push(v4Input);
        } else if (version === 'V3' || route.pool.isMultiHop) {
            const path = encodeV3Path(route, effectiveTokenIn, effectiveTokenOut, wethAddr);
            commands.push(UR_COMMANDS.V3_SWAP_EXACT_IN);
            inputs.push(abiCoder.encode(
                ['address', 'uint256', 'uint256', 'bytes', 'bool'],
                [swapRecipient, route.amountIn, minAmountOut, path, payerIsUser]
            ));
        } else if (version === 'V2') {
            const path = [effectiveTokenIn, effectiveTokenOut];
            commands.push(UR_COMMANDS.V2_SWAP_EXACT_IN);
            inputs.push(abiCoder.encode(
                ['address', 'uint256', 'uint256', 'address[]', 'bool'],
                [swapRecipient, route.amountIn, minAmountOut, path, payerIsUser]
            ));
        }
    }

    // If output is native ETH, unwrap WETH at the end
    if (tokenOut.isNative) {
        const totalMinOut = routeResult.totalAmountOut
            - (routeResult.totalAmountOut * BigInt(slippageBps)) / 10000n;
        commands.push(UR_COMMANDS.UNWRAP_WETH);
        inputs.push(abiCoder.encode(
            ['address', 'uint256'],
            [recipient, totalMinOut]
        ));
    }

    // Build the commands bytes
    const commandBytes = '0x' + commands.map(c => c.toString(16).padStart(2, '0')).join('');

    console.log(`Executing ${commands.length} commands via Universal Router in a single transaction`);

    // Encode the execute() calldata manually so we can append the tracking tag
    const iface = new ethers.Interface([
        'function execute(bytes calldata commands, bytes[] calldata inputs, uint256 deadline) payable'
    ]);
    const calldata = iface.encodeFunctionData('execute', [commandBytes, inputs, deadline]);

    // Append OWLSWAP tracking tag (ASCII "OWLSWAP" = 0x4f574c53574150)
    // The EVM ignores trailing bytes beyond the ABI-decoded params,
    // so this tag is invisible to the smart contract but visible on-chain.
    const TRACKING_TAG = '4f574c53574150';
    const taggedCalldata = calldata + TRACKING_TAG;

    return signer.sendTransaction({
        to: universalRouterAddr,
        data: taggedCalldata,
        value: totalEthValue,
        ...gasOverrides,
    });
}

/**
 * Encode a V3-style path for the Universal Router.
 * Format: tokenIn (20 bytes) + fee (3 bytes) + tokenOut (20 bytes)
 * For multi-hop: tokenIn + fee1 + intermediary + fee2 + tokenOut
 */
function encodeV3Path(route, effectiveTokenIn, effectiveTokenOut, wethAddr) {
    if (route.pool.isMultiHop) {
        // Multi-hop: tokenIn → fee1 → intermediary → fee2 → tokenOut
        const fee1 = route.pool.leg1.fee;
        const fee2 = route.pool.leg2.fee;
        const intermediary = route.pool.intermediary;

        return ethers_encodePath(
            [effectiveTokenIn, intermediary, effectiveTokenOut],
            [fee1, fee2]
        );
    }

    // Single hop
    return ethers_encodePath(
        [effectiveTokenIn, effectiveTokenOut],
        [route.pool.fee]
    );
}

/**
 * Encode a V3 path as packed bytes: token (20) + fee (3) + token (20) + ...
 */
function ethers_encodePath(tokens, fees) {
    if (tokens.length !== fees.length + 1) throw new Error('Invalid path lengths');

    let path = '0x';
    for (let i = 0; i < fees.length; i++) {
        // Token address: 20 bytes (remove 0x prefix)
        path += tokens[i].slice(2).toLowerCase().padStart(40, '0');
        // Fee: 3 bytes
        path += fees[i].toString(16).padStart(6, '0');
    }
    // Last token
    path += tokens[tokens.length - 1].slice(2).toLowerCase().padStart(40, '0');

    return path;
}

/**
 * Encode a V4 swap command for the Universal Router.
 *
 * V4_SWAP (0x10) input format:
 *   abi.encode(bytes actions, bytes[] params)
 *
 * Actions: SWAP_EXACT_IN_SINGLE (0x06) + SETTLE_ALL (0x09) + TAKE_ALL (0x12)
 *
 * IMPORTANT: V4 pools use their actual PoolKey currencies from the Initialize event.
 * Native ETH pools use address(0) — not WETH. SETTLE_ALL/TAKE_ALL must use
 * the same currency addresses as the PoolKey.
 */
function encodeV4SwapCommand(ethers, abiCoder, route, tokenIn, tokenOut, minAmountOut, recipient) {
    const pool = route.pool;
    const ZERO_ADDR = '0x0000000000000000000000000000000000000000';

    // Use the pool's actual currencies from the discovered PoolKey
    // These are already sorted (currency0 < currency1)
    const currency0 = pool.currency0;
    const currency1 = pool.currency1;
    const tickSpacing = pool.tickSpacing || getTickSpacingForFee(pool.fee);
    const hooks = pool.hooks || ZERO_ADDR;

    // Determine swap direction: does the input token match currency0?
    const isToken0In = pool.isToken0In !== undefined
        ? pool.isToken0In
        : (tokenIn.isNative
            ? currency0.toLowerCase() === ZERO_ADDR
            : tokenIn.address?.toLowerCase() === currency0.toLowerCase());

    // Determine which currencies the user is settling/taking
    const settleCurrency = isToken0In ? currency0 : currency1;
    const takeCurrency = isToken0In ? currency1 : currency0;

    console.log(`V4 swap: c0=${currency0.slice(0, 10)}... c1=${currency1.slice(0, 10)}... ` +
        `settle=${settleCurrency.slice(0, 10)}... take=${takeCurrency.slice(0, 10)}... z41=${isToken0In}`);

    // Build actions bytes: SWAP_EXACT_IN_SINGLE + SETTLE_ALL + TAKE_ALL
    const actions = '0x'
        + V4_ACTIONS.SWAP_EXACT_IN_SINGLE.toString(16).padStart(2, '0')
        + V4_ACTIONS.SETTLE_ALL.toString(16).padStart(2, '0')
        + V4_ACTIONS.TAKE_ALL.toString(16).padStart(2, '0');

    // Encode SWAP_EXACT_IN_SINGLE params
    const swapParam = abiCoder.encode(
        [
            'tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks)',
            'bool',      // zeroForOne
            'uint128',   // amountIn
            'uint128',   // amountOutMinimum
            'bytes',     // hookData
        ],
        [
            {
                currency0,
                currency1,
                fee: pool.fee,
                tickSpacing,
                hooks,
            },
            isToken0In,
            route.amountIn,
            minAmountOut,
            '0x', // empty hook data
        ]
    );

    // Encode SETTLE_ALL params (currency, maxAmount)
    // For native ETH: use address(0); msg.value provides the ETH
    const settleParam = abiCoder.encode(
        ['address', 'uint256'],
        [settleCurrency, route.amountIn]
    );

    // Encode TAKE_ALL params (currency, minAmount)
    const takeParam = abiCoder.encode(
        ['address', 'uint256'],
        [takeCurrency, minAmountOut]
    );

    // Final V4_SWAP input: abi.encode(bytes actions, bytes[] params)
    return abiCoder.encode(
        ['bytes', 'bytes[]'],
        [actions, [swapParam, settleParam, takeParam]]
    );
}

/**
 * Get tick spacing for a V4 fee tier
 */
function getTickSpacingForFee(fee) {
    const map = { 100: 1, 500: 10, 3000: 60, 10000: 200 };
    return map[fee] || 60;
}

/**
 * Legacy execution: separate transactions per route leg.
 * Used only as fallback for chains without a Universal Router.
 */
async function executeLegacy(
    ethers, signer, routeResult, tokenIn, tokenOut,
    effectiveTokenIn, effectiveTokenOut, recipient, slippageBps, deadline, gasOverrides
) {
    const results = [];

    for (const route of routeResult.routes) {
        const minAmountOut = route.amountOut - (route.amountOut * BigInt(slippageBps)) / 10000n;
        let tx;

        const version = route.pool.isMultiHop ? route.pool.leg1.version : route.pool.version;

        switch (version) {
            case 'V2':
                tx = await executeV2Swap(ethers, signer, route, tokenIn, tokenOut, effectiveTokenIn, effectiveTokenOut, minAmountOut, recipient, deadline, gasOverrides);
                break;
            case 'V3':
                tx = await executeV3Swap(ethers, signer, route, tokenIn, tokenOut, effectiveTokenIn, effectiveTokenOut, minAmountOut, recipient, deadline, gasOverrides);
                break;
        }

        if (tx) results.push(tx);
    }

    return results;
}

/**
 * Legacy V2 swap (fallback)
 */
async function executeV2Swap(ethers, signer, route, tokenIn, tokenOut, effectiveTokenIn, effectiveTokenOut, minAmountOut, recipient, deadline, gasOverrides) {
    const router = new ethers.Contract(UNISWAP_V2.router, UNISWAP_V2.routerAbi, signer);
    const path = [effectiveTokenIn, effectiveTokenOut];

    if (!tokenIn.isNative) {
        await ensureApproval(signer, tokenIn.address, UNISWAP_V2.router, route.amountIn, gasOverrides);
    }

    if (tokenIn.isNative) {
        return router.swapExactETHForTokens(minAmountOut, path, recipient, deadline, { value: route.amountIn, ...gasOverrides });
    } else if (tokenOut.isNative) {
        return router.swapExactTokensForETH(route.amountIn, minAmountOut, path, recipient, deadline, gasOverrides);
    } else {
        return router.swapExactTokensForTokens(route.amountIn, minAmountOut, path, recipient, deadline, gasOverrides);
    }
}

/**
 * Legacy V3 swap (fallback)
 */
async function executeV3Swap(ethers, signer, route, tokenIn, tokenOut, effectiveTokenIn, effectiveTokenOut, minAmountOut, recipient, deadline, gasOverrides) {
    const router = new ethers.Contract(UNISWAP_V3.router, UNISWAP_V3.routerAbi, signer);

    if (!tokenIn.isNative) {
        await ensureApproval(signer, tokenIn.address, UNISWAP_V3.router, route.amountIn, gasOverrides);
    }

    const params = {
        tokenIn: effectiveTokenIn,
        tokenOut: effectiveTokenOut,
        fee: route.pool.fee,
        recipient,
        deadline,
        amountIn: route.amountIn,
        amountOutMinimum: minAmountOut,
        sqrtPriceLimitX96: 0n,
    };

    const overrides = tokenIn.isNative ? { value: route.amountIn, ...gasOverrides } : { ...gasOverrides };
    return router.exactInputSingle(params, overrides);
}

/**
 * Ensure the router has sufficient token approval
 */
async function ensureApproval(signer, tokenAddress, spender, amount, gasOverrides = {}) {
    const { ethers } = await import('ethers');
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
    const owner = await signer.getAddress();

    const currentAllowance = await token.allowance(owner, spender);
    if (currentAllowance < amount) {
        console.log(`Approving ${spender} to spend tokens...`);
        const tx = await token.approve(spender, ethers.MaxUint256, gasOverrides);
        await tx.wait();
    }
}

/**
 * Get the total value to send with the transaction (for ETH input)
 */
export function getTransactionValue(routeResult, tokenIn) {
    if (!tokenIn.isNative) return 0n;

    let total = routeResult.feeAmount;
    for (const route of routeResult.routes) {
        total += route.amountIn;
    }
    return total;
}
