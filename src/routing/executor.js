/**
 * Route Executor — builds and submits transactions for the optimized route
 * Handles V2, V3, and V4 swap encoding and token approvals.
 *
 * Explicitly sets EIP-1559 gas parameters to avoid MetaMask's inflated
 * default priority fee (2 gwei). Fetches the real priority fee from
 * the network and uses that instead.
 */
import { UNISWAP_V2, UNISWAP_V3, UNISWAP_V4, ERC20_ABI, getCurrentChainId, getGasConfig } from '../config/contracts.js';
import { NATIVE_ETH, WETH_ADDRESS, getRoutingAddress, isWrapUnwrap } from '../config/tokens.js';
import { feeManager } from '../fees/feeManager.js';

// ─── WETH ABI for wrap/unwrap ───
const WETH_ABI = [
    'function deposit() payable',
    'function withdraw(uint256 wad)',
];

/**
 * Build EIP-1559 gas overrides from live network data.
 *
 * Uses eth_feeHistory to sample the 25th-percentile priority fee
 * from the last 5 blocks — this reflects the actual minimum tip
 * getting included on-chain, rather than provider defaults.
 *
 * @param {import('ethers').Provider} provider
 * @returns {Promise<{ maxFeePerGas: bigint, maxPriorityFeePerGas: bigint }>}
 */
async function buildGasOverrides(provider) {
    try {
        // 1. Get the latest block's base fee
        const latestBlock = await provider.getBlock('latest');
        const baseFee = latestBlock?.baseFeePerGas || 10_000_000_000n;

        // 2. Query fee history: last 5 blocks, 25th percentile reward
        let priorityFee;
        try {
            const feeHistory = await provider.send('eth_feeHistory', ['0x5', 'latest', [25]]);
            const rewards = (feeHistory.reward || [])
                .map(r => BigInt(r[0]))
                .filter(r => r > 0n);

            if (rewards.length > 0) {
                // Use the median of the 25th-percentile tips
                rewards.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
                priorityFee = rewards[Math.floor(rewards.length / 2)];
            }
        } catch {
            // eth_feeHistory may not be supported by all providers
        }

        // 3. Fallback to provider's feeData if feeHistory didn't work
        if (!priorityFee) {
            const feeData = await provider.getFeeData();
            priorityFee = feeData.maxPriorityFeePerGas || 100_000_000n;
        }

        // 4. Clamp using chain-specific gas bounds
        const { minTipWei, maxTipWei } = getGasConfig();
        priorityFee = priorityFee < minTipWei ? minTipWei : priorityFee > maxTipWei ? maxTipWei : priorityFee;

        // 5. maxFeePerGas = baseFee × 1.125 + priorityFee (tight but safe)
        const maxFeePerGas = baseFee + baseFee / 8n + priorityFee;

        console.log(
            `Gas: baseFee=${Number(baseFee) / 1e9}gwei, tip=${Number(priorityFee) / 1e9}gwei, maxFee=${Number(maxFeePerGas) / 1e9}gwei`
        );

        return {
            maxFeePerGas,
            maxPriorityFeePerGas: priorityFee,
        };
    } catch (e) {
        console.warn('Failed to fetch gas params, letting wallet decide:', e.message);
        return {};
    }
}

/**
 * Execute a native ↔ wrapped native wrap or unwrap.
 * Calls WETH.deposit() for wrapping or WETH.withdraw() for unwrapping.
 *
 * @param {import('ethers').Signer} signer
 * @param {bigint} amount — amount to wrap or unwrap
 * @param {boolean} isWrap — true = native→wrapped (deposit), false = wrapped→native (withdraw)
 * @param {string} wethAddress — the WETH contract address on this chain
 * @returns {Promise<import('ethers').TransactionResponse>}
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
 * Execute the optimized route
 * @param {import('ethers').Signer} signer — connected wallet signer
 * @param {object} routeResult — from optimizer
 * @param {object} tokenIn
 * @param {object} tokenOut
 * @param {number} slippageBps — slippage tolerance in bps
 * @param {number} deadlineMinutes — transaction deadline
 * @returns {Promise<import('ethers').TransactionResponse>}
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

    // Fetch live gas params once for all legs
    const gasOverrides = await buildGasOverrides(signer.provider);

    // For simplicity in a multi-route split, execute each leg as a separate tx
    // In production, you'd batch these via Universal Router or a custom contract
    const results = [];

    for (const route of routeResult.routes) {
        // Calculate minimum output with slippage
        const minAmountOut = route.amountOut - (route.amountOut * BigInt(slippageBps)) / 10000n;

        let tx;
        switch (route.pool.version) {
            case 'V2':
                tx = await executeV2Swap(signer, route, tokenIn, tokenOut, minAmountOut, deadline, gasOverrides);
                break;
            case 'V3':
                tx = await executeV3Swap(signer, route, tokenIn, tokenOut, minAmountOut, deadline, gasOverrides);
                break;
            case 'V4':
                tx = await executeV4Swap(signer, route, tokenIn, tokenOut, minAmountOut, deadline, gasOverrides);
                break;
        }

        if (tx) results.push(tx);
    }

    return results;
}

/**
 * Execute a V2 swap
 */
async function executeV2Swap(signer, route, tokenIn, tokenOut, minAmountOut, deadline, gasOverrides) {
    const { ethers } = await import('ethers');
    const router = new ethers.Contract(UNISWAP_V2.router, UNISWAP_V2.routerAbi, signer);
    const recipient = await signer.getAddress();

    const path = [
        tokenIn.isNative ? WETH_ADDRESS : tokenIn.address,
        tokenOut.isNative ? WETH_ADDRESS : tokenOut.address,
    ];

    // Handle token approval for non-ETH input
    if (!tokenIn.isNative) {
        await ensureApproval(signer, tokenIn.address, UNISWAP_V2.router, route.amountIn, gasOverrides);
    }

    if (tokenIn.isNative) {
        return router.swapExactETHForTokens(
            minAmountOut,
            path,
            recipient,
            deadline,
            { value: route.amountIn, ...gasOverrides }
        );
    } else if (tokenOut.isNative) {
        return router.swapExactTokensForETH(
            route.amountIn,
            minAmountOut,
            path,
            recipient,
            deadline,
            gasOverrides
        );
    } else {
        return router.swapExactTokensForTokens(
            route.amountIn,
            minAmountOut,
            path,
            recipient,
            deadline,
            gasOverrides
        );
    }
}

/**
 * Execute a V3 swap
 */
async function executeV3Swap(signer, route, tokenIn, tokenOut, minAmountOut, deadline, gasOverrides) {
    const { ethers } = await import('ethers');
    const router = new ethers.Contract(UNISWAP_V3.router, UNISWAP_V3.routerAbi, signer);
    const recipient = await signer.getAddress();

    const effectiveTokenIn = tokenIn.isNative ? WETH_ADDRESS : tokenIn.address;
    const effectiveTokenOut = tokenOut.isNative ? WETH_ADDRESS : tokenOut.address;

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

    const overrides = tokenIn.isNative
        ? { value: route.amountIn, ...gasOverrides }
        : { ...gasOverrides };

    return router.exactInputSingle(params, overrides);
}

/**
 * Execute a V4 swap via Universal Router
 */
async function executeV4Swap(signer, route, tokenIn, tokenOut, minAmountOut, deadline, gasOverrides) {
    const { ethers } = await import('ethers');
    const universalRouter = new ethers.Contract(
        UNISWAP_V4.universalRouter,
        UNISWAP_V4.universalRouterAbi,
        signer
    );

    // V4_SWAP command = 0x10
    const V4_SWAP = 0x10;

    // Encode the V4 swap actions
    const abiCoder = ethers.AbiCoder.defaultAbiCoder();

    // Actions: SWAP_EXACT_IN_SINGLE (0x06), SETTLE_ALL (0x09), TAKE_ALL (0x12)
    const actions = '0x060912';

    // Encode swap params
    const poolKey = {
        currency0: route.pool.currency0 || tokenIn.address,
        currency1: route.pool.currency1 || tokenOut.address,
        fee: route.pool.fee,
        tickSpacing: route.pool.tickSpacing || 60,
        hooks: route.pool.hooks || '0x0000000000000000000000000000000000000000',
    };

    const commands = ethers.toBeHex(V4_SWAP);
    const inputs = [
        abiCoder.encode(
            ['bytes', 'uint256'],
            [actions, minAmountOut]
        ),
    ];

    const overrides = tokenIn.isNative
        ? { value: route.amountIn, ...gasOverrides }
        : { ...gasOverrides };

    return universalRouter.execute(commands, inputs, deadline, overrides);
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
        const tx = await token.approve(spender, ethers.MaxUint256, gasOverrides);
        await tx.wait();
    }
}

/**
 * Get the total value to send with the transaction (for ETH input)
 */
export function getTransactionValue(routeResult, tokenIn) {
    if (!tokenIn.isNative) return 0n;

    // Sum of all route amounts + fee
    let total = routeResult.feeAmount;
    for (const route of routeResult.routes) {
        total += route.amountIn;
    }
    return total;
}
