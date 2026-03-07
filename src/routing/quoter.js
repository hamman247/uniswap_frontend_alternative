/**
 * Quoter — gets price quotes from V2, V3, and V4 pools
 */
import { UNISWAP_V2, UNISWAP_V3 } from '../config/contracts.js';

const Q96 = 2n ** 96n;
const Q192 = Q96 * Q96;

/**
 * Get a quote from a specific pool
 * @param {import('ethers').Provider} provider
 * @param {object} pool — pool descriptor from poolDiscovery
 * @param {bigint} amountIn — raw amount in wei
 * @param {number} decimalsIn
 * @param {number} decimalsOut
 * @returns {Promise<{ amountOut: bigint, priceImpact: number, gasEstimate: number }>}
 */
export async function getQuote(provider, pool, amountIn, decimalsIn, decimalsOut) {
    switch (pool.version) {
        case 'V2':
            return getV2Quote(pool, amountIn);
        case 'V3':
            return getV3Quote(provider, pool, amountIn);
        case 'V4':
            return getV4Quote(pool, amountIn);
        default:
            throw new Error(`Unknown pool version: ${pool.version}`);
    }
}

/**
 * V2 Quote — constant product formula (x * y = k)
 * amountOut = (amountIn * 997 * reserveOut) / (reserveIn * 1000 + amountIn * 997)
 */
function getV2Quote(pool, amountIn) {
    const reserveIn = BigInt(pool.reserveIn);
    const reserveOut = BigInt(pool.reserveOut);

    if (reserveIn === 0n || reserveOut === 0n) {
        return { amountOut: 0n, priceImpact: 100, gasEstimate: pool.gasEstimate };
    }

    const amountInWithFee = amountIn * 997n;
    const numerator = amountInWithFee * reserveOut;
    const denominator = reserveIn * 1000n + amountInWithFee;
    const amountOut = numerator / denominator;

    // Price impact calculation
    const spotPrice = (reserveOut * 10000n) / reserveIn;
    const executionPrice = amountOut > 0n ? (amountOut * 10000n) / amountIn : 0n;
    const priceImpact = spotPrice > 0n
        ? Number(((spotPrice - executionPrice) * 10000n) / spotPrice) / 100
        : 0;

    return {
        amountOut,
        priceImpact: Math.max(0, priceImpact),
        gasEstimate: pool.gasEstimate,
    };
}

/**
 * V3 Quote — uses QuoterV2 contract for accurate quote
 * Falls back to sqrtPriceX96 math if quoter fails
 */
async function getV3Quote(provider, pool, amountIn) {
    try {
        const quoterAddr = UNISWAP_V3.quoterV2;
        if (!quoterAddr) {
            // No quoter deployed on this chain — use math fallback
            return getV3QuoteMath(pool, amountIn);
        }

        const { ethers } = await import('ethers');

        const quoter = new ethers.Contract(
            quoterAddr,
            UNISWAP_V3.quoterAbi,
            provider
        );

        const result = await quoter.quoteExactInputSingle.staticCall({
            tokenIn: pool.tokenIn,
            tokenOut: pool.tokenOut,
            amountIn: amountIn,
            fee: pool.fee,
            sqrtPriceLimitX96: 0n,
        });

        const amountOut = result.amountOut || result[0];
        const gasEstimate = result.gasEstimate || result[3] || BigInt(pool.gasEstimate);

        // Price impact from sqrtPrice change
        const sqrtPriceAfter = result.sqrtPriceX96After || result[1];
        const priceImpact = calculateV3PriceImpact(pool.sqrtPriceX96, sqrtPriceAfter);

        return {
            amountOut,
            priceImpact,
            gasEstimate: Number(gasEstimate),
        };
    } catch (e) {
        // Fallback to math-based quote using sqrtPriceX96
        return getV3QuoteMath(pool, amountIn);
    }
}

/**
 * V3 fallback quote using sqrtPriceX96 math
 */
function getV3QuoteMath(pool, amountIn) {
    const sqrtPriceX96 = BigInt(pool.sqrtPriceX96);
    const liquidity = BigInt(pool.liquidity);
    const feeBps = BigInt(pool.fee);

    if (liquidity === 0n || sqrtPriceX96 === 0n) {
        return { amountOut: 0n, priceImpact: 100, gasEstimate: pool.gasEstimate };
    }

    // Apply pool fee
    const amountInAfterFee = (amountIn * (1000000n - feeBps)) / 1000000n;

    let amountOut;
    if (pool.isToken0In) {
        // token0 → token1: price = (sqrtPriceX96)^2 / 2^192
        const price = (sqrtPriceX96 * sqrtPriceX96) / Q192;
        amountOut = price > 0n ? amountInAfterFee * price : 0n;

        // Better calculation using liquidity
        if (liquidity > 0n) {
            const sqrtPriceDelta = (amountInAfterFee * Q96) / liquidity;
            const newSqrtPrice = sqrtPriceX96 + sqrtPriceDelta;
            if (newSqrtPrice > 0n) {
                const amount1Delta = (liquidity * (newSqrtPrice - sqrtPriceX96)) / Q96;
                if (amount1Delta > 0n) amountOut = amount1Delta;
            }
        }
    } else {
        // token1 → token0: price = 2^192 / (sqrtPriceX96)^2
        if (sqrtPriceX96 > 0n) {
            const sqrtPriceDelta = (amountInAfterFee * Q96) / liquidity;
            if (sqrtPriceX96 > sqrtPriceDelta) {
                const newSqrtPrice = sqrtPriceX96 - sqrtPriceDelta;
                const amount0Delta = (liquidity * Q96 * (sqrtPriceX96 - newSqrtPrice)) /
                    (sqrtPriceX96 * newSqrtPrice);
                amountOut = amount0Delta;
            }
        }
    }

    if (!amountOut || amountOut <= 0n) {
        return { amountOut: 0n, priceImpact: 100, gasEstimate: pool.gasEstimate };
    }

    return {
        amountOut,
        priceImpact: 0.1, // approximate for math fallback
        gasEstimate: pool.gasEstimate,
    };
}

/**
 * V4 Quote — similar math to V3 (same AMM model)
 */
function getV4Quote(pool, amountIn) {
    // V4 uses the same concentrated liquidity math as V3
    return getV3QuoteMath(pool, amountIn);
}

/**
 * Calculate V3 price impact from sqrt price change
 */
function calculateV3PriceImpact(sqrtPriceBefore, sqrtPriceAfter) {
    if (!sqrtPriceBefore || !sqrtPriceAfter) return 0;
    const before = Number(sqrtPriceBefore);
    const after = Number(sqrtPriceAfter);
    if (before === 0) return 0;
    const priceBefore = before * before;
    const priceAfter = after * after;
    const impact = Math.abs((priceAfter - priceBefore) / priceBefore) * 100;
    return Math.round(impact * 100) / 100;
}

/**
 * Get quotes from all pools at once
 */
export async function getQuotesForPools(provider, pools, amountIn, decimalsIn, decimalsOut) {
    const results = await Promise.allSettled(
        pools.map(pool => getQuote(provider, pool, amountIn, decimalsIn, decimalsOut))
    );

    return results.map((result, i) => ({
        pool: pools[i],
        ...(result.status === 'fulfilled'
            ? result.value
            : { amountOut: 0n, priceImpact: 100, gasEstimate: pools[i].gasEstimate }
        ),
    }));
}
