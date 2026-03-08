/**
 * Route Optimizer — finds the optimal split across V2, V3, V4 pools
 *
 * Uses a greedy split algorithm that minimizes slippage:
 *   1. Divides the trade into N equal chunks
 *   2. For each chunk, queries every pool for the MARGINAL output
 *      (i.e. the additional output from adding one more chunk, given
 *       what's already been allocated to that pool)
 *   3. Assigns the chunk to the pool with the highest marginal output
 *
 * This works because AMM price impact is concave — the more you trade
 * through one pool the worse it gets, so splitting reduces total slippage.
 */
import { getQuote, getQuotesForPools } from './quoter.js';
import { feeManager } from '../fees/feeManager.js';
import { getGasPrice } from '../utils/gasOracle.js';

const NUM_CHUNKS = 20; // Split trade into 20 chunks for optimization granularity

/**
 * @typedef {Object} RouteResult
 * @property {Array} routes — ordered list of route legs
 * @property {bigint} totalAmountOut — total output amount
 * @property {bigint} totalAmountIn — total input (before fee)
 * @property {bigint} totalAmountAfterFee — input amount after fee deduction
 * @property {bigint} feeAmount — fee deducted from input
 * @property {number} priceImpact — weighted price impact
 * @property {number} totalGas — estimated total gas
 * @property {string} effectivePrice — effective execution price
 */

/**
 * Find the optimal route across all available pools
 * @param {import('ethers').Provider} provider
 * @param {Array} pools — discovered pools from poolDiscovery
 * @param {bigint} amountIn — raw input amount (before fee)
 * @param {number} decimalsIn
 * @param {number} decimalsOut
 * @returns {Promise<RouteResult>}
 */
export async function findOptimalRoute(provider, pools, amountIn, decimalsIn, decimalsOut) {
    if (!pools.length) {
        return null;
    }

    // Step 1: Deduct the 5 bps interface fee
    const { fee: feeAmount, amountAfterFee } = feeManager.calculateFee(amountIn);

    if (amountAfterFee <= 0n) {
        return null;
    }

    // Step 2: If only one pool, route everything through it
    if (pools.length === 1) {
        return singlePoolRoute(provider, pools[0], amountIn, amountAfterFee, feeAmount, decimalsIn, decimalsOut);
    }

    // Step 3: Greedy split optimization across multiple pools
    return splitRoute(provider, pools, amountIn, amountAfterFee, feeAmount, decimalsIn, decimalsOut);
}

/**
 * Route entirely through a single pool
 */
async function singlePoolRoute(provider, pool, totalAmountIn, amountAfterFee, feeAmount, decimalsIn, decimalsOut) {
    const q = await getQuote(provider, pool, amountAfterFee, decimalsIn, decimalsOut);

    return {
        routes: [{
            pool,
            amountIn: amountAfterFee,
            amountOut: q.amountOut,
            percentage: 100,
            priceImpact: q.priceImpact,
            gasEstimate: q.gasEstimate,
        }],
        totalAmountIn: totalAmountIn,
        totalAmountAfterFee: amountAfterFee,
        totalAmountOut: q.amountOut,
        feeAmount,
        priceImpact: q.priceImpact,
        totalGas: q.gasEstimate,
        effectivePrice: calculateEffectivePrice(amountAfterFee, q.amountOut, decimalsIn, decimalsOut),
    };
}

/**
 * Greedy split route optimizer — minimizes slippage
 *
 * Key insight: For each chunk, we compare the MARGINAL output across pools.
 * marginalOutput[pool] = quote(currentAllocation + chunk) - quote(currentAllocation)
 * We assign the chunk to whichever pool has the highest marginal output.
 *
 * This naturally distributes volume away from pools that are getting worse
 * (higher slippage) toward pools that still have favorable rates.
 */
async function splitRoute(provider, pools, totalAmountIn, amountAfterFee, feeAmount, decimalsIn, decimalsOut) {
    const chunkSize = amountAfterFee / BigInt(NUM_CHUNKS);
    if (chunkSize === 0n) {
        // Amount too small to split, use best single pool
        return pickBestSinglePool(provider, pools, totalAmountIn, amountAfterFee, feeAmount, decimalsIn, decimalsOut);
    }

    // Track cumulative allocation and cumulative output per pool
    const allocations = new Array(pools.length).fill(0n);     // amount allocated
    const currentOutputs = new Array(pools.length).fill(0n);  // output at current allocation

    // For each chunk, find the pool with the best MARGINAL output
    for (let chunk = 0; chunk < NUM_CHUNKS; chunk++) {
        const currentChunk = chunk === NUM_CHUNKS - 1
            ? amountAfterFee - chunkSize * BigInt(NUM_CHUNKS - 1) // last chunk gets remainder
            : chunkSize;

        // Query all pools: "if I add this chunk to your current allocation, what's the new total output?"
        const marginalQuotes = await Promise.allSettled(
            pools.map(async (pool, i) => {
                const newAllocation = allocations[i] + currentChunk;
                const q = await getQuote(provider, pool, newAllocation, decimalsIn, decimalsOut);
                // Marginal output = total output at new allocation minus output at current allocation
                const marginalOutput = q.amountOut - currentOutputs[i];
                return {
                    marginalOutput,
                    newTotalOutput: q.amountOut,
                    priceImpact: q.priceImpact,
                    gasEstimate: q.gasEstimate,
                };
            })
        );

        // Pick the pool with the highest marginal output
        let bestPoolIdx = -1;
        let bestMarginal = -1n;

        for (let i = 0; i < pools.length; i++) {
            if (marginalQuotes[i].status !== 'fulfilled') continue;
            const { marginalOutput } = marginalQuotes[i].value;
            if (marginalOutput > bestMarginal) {
                bestMarginal = marginalOutput;
                bestPoolIdx = i;
            }
        }

        // If no pool gave valid output, skip this chunk (shouldn't happen with good pools)
        if (bestPoolIdx < 0) continue;

        // Assign chunk to best pool and update its tracked output
        allocations[bestPoolIdx] += currentChunk;
        currentOutputs[bestPoolIdx] = marginalQuotes[bestPoolIdx].value.newTotalOutput;
    }

    // Build final route from the allocations
    const routes = [];
    let totalAmountOut = 0n;
    let totalGas = 0;
    let weightedImpact = 0;

    for (let i = 0; i < pools.length; i++) {
        if (allocations[i] === 0n) continue;

        const pool = pools[i];
        const q = await getQuote(provider, pool, allocations[i], decimalsIn, decimalsOut);

        const percentage = Math.round(Number(allocations[i] * 10000n / amountAfterFee) / 100);

        routes.push({
            pool,
            amountIn: allocations[i],
            amountOut: q.amountOut,
            percentage,
            priceImpact: q.priceImpact,
            gasEstimate: q.gasEstimate,
        });

        totalAmountOut += q.amountOut;
        totalGas += q.gasEstimate;
        weightedImpact += q.priceImpact * percentage;
    }

    // Sort routes by percentage descending (largest allocation first)
    routes.sort((a, b) => b.percentage - a.percentage);

    // Normalize percentages to exactly 100
    const totalPct = routes.reduce((s, r) => s + r.percentage, 0);
    if (totalPct !== 100 && routes.length > 0) {
        routes[0].percentage += (100 - totalPct);
    }

    return {
        routes,
        totalAmountIn: totalAmountIn,
        totalAmountAfterFee: amountAfterFee,
        totalAmountOut,
        feeAmount,
        priceImpact: weightedImpact / 100,
        totalGas,
        effectivePrice: calculateEffectivePrice(amountAfterFee, totalAmountOut, decimalsIn, decimalsOut),
    };
}

/**
 * Fallback: pick single best pool when amount is too small to split
 */
async function pickBestSinglePool(provider, pools, totalAmountIn, amountAfterFee, feeAmount, decimalsIn, decimalsOut) {
    const quotes = await getQuotesForPools(provider, pools, amountAfterFee, decimalsIn, decimalsOut);
    const gasPriceWei = await getGasPrice(provider);

    let bestIdx = 0;
    let bestOut = 0n;
    for (let i = 0; i < quotes.length; i++) {
        const gasAdj = adjustForGas(quotes[i].amountOut, quotes[i].gasEstimate, decimalsOut, gasPriceWei);
        if (gasAdj > bestOut) {
            bestOut = gasAdj;
            bestIdx = i;
        }
    }

    const best = quotes[bestIdx];
    return {
        routes: [{
            pool: best.pool,
            amountIn: amountAfterFee,
            amountOut: best.amountOut,
            percentage: 100,
            priceImpact: best.priceImpact,
            gasEstimate: best.gasEstimate,
        }],
        totalAmountIn: totalAmountIn,
        totalAmountAfterFee: amountAfterFee,
        totalAmountOut: best.amountOut,
        feeAmount,
        priceImpact: best.priceImpact,
        totalGas: best.gasEstimate,
        effectivePrice: calculateEffectivePrice(amountAfterFee, best.amountOut, decimalsIn, decimalsOut),
    };
}

/**
 * Adjust output for gas costs (in output token terms) for pool comparison
 */
function adjustForGas(amountOut, gasEstimate, decimalsOut, gasPriceWei) {
    const gasCostWei = BigInt(gasEstimate) * gasPriceWei;
    const gasCostInTokens = gasCostWei / BigInt(10 ** Math.max(0, 18 - decimalsOut));
    return amountOut > gasCostInTokens ? amountOut - gasCostInTokens : 0n;
}

/**
 * Calculate effective execution price
 */
function calculateEffectivePrice(amountIn, amountOut, decimalsIn, decimalsOut) {
    if (amountIn === 0n || amountOut === 0n) return '0';
    const inFloat = Number(amountIn) / (10 ** decimalsIn);
    const outFloat = Number(amountOut) / (10 ** decimalsOut);
    if (inFloat === 0) return '0';
    return (outFloat / inFloat).toPrecision(6);
}
