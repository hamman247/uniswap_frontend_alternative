/**
 * Pool Discovery — finds available pools across Uniswap V2, V3, and V4
 *
 * Chain-aware: only discovers pools for protocol versions that
 * the current chain actually supports, using contract addresses
 * from the chain config.
 */
import { UNISWAP_V2, UNISWAP_V3, UNISWAP_V4, getCurrentChainId } from '../config/contracts.js';
import { getRoutingAddress } from '../config/tokens.js';
import { chainSupportsVersion } from '../config/chains.js';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

/**
 * Discover all available pools for a token pair across V2, V3, V4
 * Only queries versions supported by the current chain.
 *
 * @param {import('ethers').Provider} provider
 * @param {object} tokenIn
 * @param {object} tokenOut
 * @returns {Promise<Array>} Array of pool descriptors
 */
export async function discoverPools(provider, tokenIn, tokenOut) {
    const chainId = getCurrentChainId();
    const addressIn = getRoutingAddress(tokenIn, chainId);
    const addressOut = getRoutingAddress(tokenOut, chainId);

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
