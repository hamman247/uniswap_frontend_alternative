/**
 * Pool Discovery — finds available pools across Uniswap V2, V3, and V4
 *
 * Chain-aware: only discovers pools for protocol versions that
 * the current chain actually supports, using contract addresses
 * from the chain config.
 *
 * Multi-hop: when no direct pool exists, tries routing through
 * common intermediary tokens (native gas, WETH, USDC, USDT, etc.)
 */
import { UNISWAP_V2, UNISWAP_V3, UNISWAP_V4, getCurrentChainId } from '../config/contracts.js';
import { getRoutingAddress, WETH_ADDRESS } from '../config/tokens.js';
import { chainSupportsVersion, getChain } from '../config/chains.js';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

/**
 * Common bridge tokens for multi-hop routing.
 * These are the most liquid intermediaries on most chains.
 * Chain-specific addresses are resolved at runtime.
 */
const BRIDGE_TOKENS = {
    // Mainnet addresses — on other chains these may not exist,
    // which is fine (pool lookup will simply return nothing)
    WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    WBTC: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    wstETH: '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0',
    WISE: '0x66a0f676479Cee1d7373f3DC2e2952778BfF5bd6',
};

/**
 * Get chain-specific bridge tokens for multi-hop routing
 */
function getBridgeTokens(chainId) {
    const chain = getChain(chainId);
    const bridges = new Set();

    // Always include the chain's wrapped native token
    if (chain?.wethAddress) {
        bridges.add(chain.wethAddress.toLowerCase());
    }

    // Add common bridge tokens (mainnet-specific addresses will fail gracefully on other chains)
    for (const addr of Object.values(BRIDGE_TOKENS)) {
        bridges.add(addr.toLowerCase());
    }

    return [...bridges];
}

/**
 * Discover all available pools for a token pair across V2, V3, V4.
 * If no direct pools are found, attempts multi-hop routing through
 * common intermediary tokens.
 *
 * @param {import('ethers').Provider} provider
 * @param {object} tokenIn
 * @param {object} tokenOut
 * @returns {Promise<Array>} Array of pool descriptors (direct or multi-hop)
 */
export async function discoverPools(provider, tokenIn, tokenOut) {
    const chainId = getCurrentChainId();
    const addressIn = getRoutingAddress(tokenIn, chainId);
    const addressOut = getRoutingAddress(tokenOut, chainId);

    // 1. Try direct pools first
    const directPools = await discoverDirectPools(provider, addressIn, addressOut, chainId);
    if (directPools.length > 0) {
        return directPools;
    }

    // 2. No direct pools — try multi-hop through bridge tokens
    console.log('No direct pools found, trying multi-hop routing...');
    const multiHopPools = await discoverMultiHopPools(provider, addressIn, addressOut, chainId);
    return multiHopPools;
}

/**
 * Discover direct pools between two tokens
 */
async function discoverDirectPools(provider, addressIn, addressOut, chainId) {
    const promises = [];

    if (chainSupportsVersion(chainId, 'V2')) {
        promises.push(discoverV2Pools(provider, addressIn, addressOut));
    }
    if (chainSupportsVersion(chainId, 'V3')) {
        promises.push(discoverV3Pools(provider, addressIn, addressOut));
    }
    if (chainSupportsVersion(chainId, 'V4')) {
        promises.push(discoverV4Pools(provider, addressIn, addressOut));
    }

    if (promises.length === 0) {
        console.warn(`No supported Uniswap versions on chain ${chainId}`);
        return [];
    }

    const results = await Promise.allSettled(promises);
    const pools = [];
    for (const r of results) {
        if (r.status === 'fulfilled') pools.push(...r.value);
    }
    return pools;
}

/**
 * Discover multi-hop routes through intermediary tokens.
 * For each bridge token B, tries tokenIn→B then B→tokenOut.
 * Returns pool pairs as a single "multi-hop pool" descriptor.
 */
async function discoverMultiHopPools(provider, addressIn, addressOut, chainId) {
    const bridgeTokens = getBridgeTokens(chainId);
    const multiHopPools = [];

    // Skip intermediaries that are the same as input or output
    const candidates = bridgeTokens.filter(
        b => b !== addressIn.toLowerCase() && b !== addressOut.toLowerCase()
    );

    // Query all intermediaries in parallel
    const hopPromises = candidates.map(async (bridge) => {
        try {
            const [leg1Pools, leg2Pools] = await Promise.all([
                discoverDirectPools(provider, addressIn, bridge, chainId),
                discoverDirectPools(provider, bridge, addressOut, chainId),
            ]);

            if (leg1Pools.length > 0 && leg2Pools.length > 0) {
                // Pick the best pool (highest liquidity) for each leg
                const bestLeg1 = pickBestPool(leg1Pools);
                const bestLeg2 = pickBestPool(leg2Pools);

                multiHopPools.push({
                    version: `${bestLeg1.version}→${bestLeg2.version}`,
                    isMultiHop: true,
                    intermediary: bridge,
                    leg1: bestLeg1,
                    leg2: bestLeg2,
                    tokenIn: addressIn,
                    tokenOut: addressOut,
                    fee: bestLeg1.fee + bestLeg2.fee,
                    feeLabel: `${((bestLeg1.fee + bestLeg2.fee) / 10000).toFixed(2)}%`,
                    gasEstimate: bestLeg1.gasEstimate + bestLeg2.gasEstimate,
                });
            }
        } catch (e) {
            // This intermediary didn't work — skip it
        }
    });

    await Promise.allSettled(hopPromises);

    if (multiHopPools.length > 0) {
        console.log(`Found ${multiHopPools.length} multi-hop route(s) through intermediaries`);
    }

    return multiHopPools;
}

/**
 * Pick the best pool from a list (highest liquidity)
 */
function pickBestPool(pools) {
    if (pools.length === 1) return pools[0];
    return pools.reduce((best, p) => {
        const bLiq = best.liquidity || best.reserveIn || 0n;
        const pLiq = p.liquidity || p.reserveIn || 0n;
        return pLiq > bLiq ? p : best;
    });
}

/**
 * Discover Uniswap V2 pairs
 */
async function discoverV2Pools(provider, tokenIn, tokenOut) {
    const pools = [];
    const factoryAddr = UNISWAP_V2.factory;
    if (!factoryAddr) return pools;

    try {
        const { ethers } = await import('ethers');
        const factory = new ethers.Contract(factoryAddr, UNISWAP_V2.factoryAbi, provider);
        const pairAddress = await factory.getPair(tokenIn, tokenOut);

        if (pairAddress && pairAddress !== ZERO_ADDRESS) {
            const pair = new ethers.Contract(pairAddress, UNISWAP_V2.pairAbi, provider);
            const [reserves, token0] = await Promise.all([
                pair.getReserves(),
                pair.token0(),
            ]);

            const isToken0In = tokenIn.toLowerCase() === token0.toLowerCase();

            pools.push({
                version: 'V2',
                address: pairAddress,
                tokenIn,
                tokenOut,
                fee: 3000, // 0.3% standard V2 fee
                feeLabel: '0.30%',
                reserveIn: isToken0In ? reserves[0] : reserves[1],
                reserveOut: isToken0In ? reserves[1] : reserves[0],
                liquidity: reserves[0] + reserves[1],
                gasEstimate: 150000,
            });
        }
    } catch (e) {
        console.warn('V2 pool discovery failed:', e.message);
    }
    return pools;
}

/**
 * Discover Uniswap V3 pools across all fee tiers
 */
async function discoverV3Pools(provider, tokenIn, tokenOut) {
    const pools = [];
    const factoryAddr = UNISWAP_V3.factory;
    if (!factoryAddr) return pools;

    const { ethers } = await import('ethers');
    const factory = new ethers.Contract(factoryAddr, UNISWAP_V3.factoryAbi, provider);

    const feeTierPromises = UNISWAP_V3.feeTiers.map(async (fee) => {
        try {
            const poolAddress = await factory.getPool(tokenIn, tokenOut, fee);

            if (poolAddress && poolAddress !== ZERO_ADDRESS) {
                const pool = new ethers.Contract(poolAddress, UNISWAP_V3.poolAbi, provider);
                const [slot0, liquidity, token0] = await Promise.all([
                    pool.slot0(),
                    pool.liquidity(),
                    pool.token0(),
                ]);

                if (liquidity > 0n) {
                    pools.push({
                        version: 'V3',
                        address: poolAddress,
                        tokenIn,
                        tokenOut,
                        fee,
                        feeLabel: `${(fee / 10000).toFixed(2)}%`,
                        sqrtPriceX96: slot0[0],
                        tick: slot0[1],
                        liquidity,
                        isToken0In: tokenIn.toLowerCase() === token0.toLowerCase(),
                        gasEstimate: 184000,
                    });
                }
            }
        } catch (e) {
            // Pool doesn't exist for this fee tier
        }
    });

    await Promise.allSettled(feeTierPromises);
    return pools;
}

/**
 * Discover Uniswap V4 pools
 * V4 uses PoolManager with pool keys instead of individual contracts
 */
async function discoverV4Pools(provider, tokenIn, tokenOut) {
    const pools = [];
    const poolManagerAddr = UNISWAP_V4.poolManager;
    if (!poolManagerAddr) return pools;

    const { ethers } = await import('ethers');

    for (const fee of UNISWAP_V4.feeTiers) {
        try {
            // Sort tokens for canonical ordering
            const [currency0, currency1] = tokenIn.toLowerCase() < tokenOut.toLowerCase()
                ? [tokenIn, tokenOut]
                : [tokenOut, tokenIn];

            const tickSpacing = getTickSpacing(fee);
            const hooks = ZERO_ADDRESS;

            const poolId = await computePoolId(currency0, currency1, fee, tickSpacing, hooks);

            const poolManager = new ethers.Contract(
                poolManagerAddr,
                UNISWAP_V4.poolManagerAbi,
                provider
            );

            const [slot0Data, liquidity] = await Promise.all([
                poolManager.getSlot0(poolId),
                poolManager.getLiquidity(poolId),
            ]);

            if (liquidity > 0n && slot0Data[0] > 0n) {
                pools.push({
                    version: 'V4',
                    poolId,
                    tokenIn,
                    tokenOut,
                    fee,
                    feeLabel: `${(fee / 10000).toFixed(2)}%`,
                    sqrtPriceX96: slot0Data[0],
                    tick: slot0Data[1],
                    liquidity,
                    tickSpacing,
                    hooks,
                    currency0,
                    currency1,
                    isToken0In: tokenIn.toLowerCase() === currency0.toLowerCase(),
                    gasEstimate: 200000,
                });
            }
        } catch (e) {
            // Pool doesn't exist for this configuration
        }
    }
    return pools;
}

/**
 * Standard tick spacing for fee tier
 */
function getTickSpacing(fee) {
    const map = { 100: 1, 500: 10, 3000: 60, 10000: 200 };
    return map[fee] || 60;
}

/**
 * Compute V4 pool ID from pool key components
 */
async function computePoolId(currency0, currency1, fee, tickSpacing, hooks) {
    try {
        const { ethers } = await import('ethers');
        const abiCoder = ethers.AbiCoder.defaultAbiCoder();
        const encoded = abiCoder.encode(
            ['address', 'address', 'uint24', 'int24', 'address'],
            [currency0, currency1, fee, tickSpacing, hooks]
        );
        return ethers.keccak256(encoded);
    } catch {
        return `0x${'0'.repeat(64)}`;
    }
}
