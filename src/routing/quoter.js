/**
 * Quoter — gets price quotes from V2, V3, and V4 pools
 */
import { UNISWAP_V2, UNISWAP_V3, UNISWAP_V4 } from '../config/contracts.js';

const Q96 = 2n ** 96n;
const Q192 = Q96 * Q96;

/**
 * Get a quote from a specific pool (direct or multi-hop)
 * @param {import('ethers').Provider} provider
 * @param {object} pool — pool descriptor from poolDiscovery
 * @param {bigint} amountIn — raw amount in wei
 * @param {number} decimalsIn
 * @param {number} decimalsOut
 * @returns {Promise<{ amountOut: bigint, priceImpact: number, gasEstimate: number }>}
 */
export async function getQuote(provider, pool, amountIn, decimalsIn, decimalsOut) {
    try {
        // Multi-hop: quote leg1, then use output as input for leg2
        if (pool.isMultiHop) {
            return await getMultiHopQuote(provider, pool, amountIn);
        }

        // API-discovered pools: use the Uniswap Routing API for quoting
        if (pool.useApiQuote) {
            return await getApiQuote(pool, amountIn);
        }

        switch (pool.version) {
            case 'V2':
                return getV2Quote(pool, amountIn);
            case 'V3':
                return await getV3Quote(provider, pool, amountIn);
            case 'V4':
                return await getV4Quote(provider, pool, amountIn);
            default:
                throw new Error(`Unknown pool version: ${pool.version}`);
        }
    } catch (e) {
        console.warn(`Quote failed for ${pool.version} pool ${pool.address}:`, e.message);
        return { amountOut: 0n, priceImpact: 100, gasEstimate: pool.gasEstimate || 200000 };
    }
}

/**
 * Get a quote from the Uniswap Routing API.
 * Used for pools discovered via the API (e.g. V4 pools with custom hooks).
 */
async function getApiQuote(pool, amountIn) {
    try {
        const { getCurrentChainId } = await import('../config/contracts.js');
        const chainId = getCurrentChainId();

        const tokenIn = pool.tokenIn === 'NATIVE' ? '0x0000000000000000000000000000000000000000' : pool.tokenIn;
        const tokenOut = pool.tokenOut === 'NATIVE' ? '0x0000000000000000000000000000000000000000' : pool.tokenOut;

        const requestBody = {
            tokenInChainId: chainId,
            tokenOutChainId: chainId,
            tokenIn,
            tokenOut,
            amount: amountIn.toString(),
            type: 'EXACT_INPUT',
            configs: [
                { routingType: 'CLASSIC', protocols: ['V2', 'V3', 'MIXED'] },
                { routingType: 'DUTCH_V2' },
            ],
        };

        const response = await fetch('/api/uniswap/v2/quote', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            console.warn('Uniswap API quote returned', response.status);
            return getV3QuoteMath(pool, amountIn); // fallback
        }

        const data = await response.json();
        const classic = data.quote || data;

        if (classic.quoteDecimals && classic.quote) {
            const amountOut = BigInt(classic.quote);
            const priceImpact = parseFloat(classic.priceImpact || '0');
            const gasEstimate = Number(classic.gasUseEstimate || pool.gasEstimate);

            return {
                amountOut,
                priceImpact: Math.round(Math.abs(priceImpact) * 100) / 100,
                gasEstimate,
            };
        }

        return getV3QuoteMath(pool, amountIn);
    } catch (e) {
        console.warn('API quote failed:', e.message);
        return getV3QuoteMath(pool, amountIn);
    }
}

/**
 * Multi-hop quote: tokenIn → intermediary → tokenOut
 * Quotes leg1 first, then feeds the output into leg2.
 */
async function getMultiHopQuote(provider, pool, amountIn) {
    // Leg 1: tokenIn → intermediary
    const leg1Quote = await getQuote(provider, pool.leg1, amountIn);
    if (leg1Quote.amountOut === 0n) {
        return { amountOut: 0n, priceImpact: 100, gasEstimate: pool.gasEstimate };
    }

    // Leg 2: intermediary → tokenOut (using leg1's output as input)
    const leg2Quote = await getQuote(provider, pool.leg2, leg1Quote.amountOut);

    // Combined price impact: 1 - (1 - impact1) * (1 - impact2)
    const combinedImpact = 1 - (1 - leg1Quote.priceImpact / 100) * (1 - leg2Quote.priceImpact / 100);

    return {
        amountOut: leg2Quote.amountOut,
        priceImpact: Math.round(combinedImpact * 10000) / 100,
        gasEstimate: leg1Quote.gasEstimate + leg2Quote.gasEstimate,
    };
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
    const quoterAddr = UNISWAP_V3.quoterV2;
    if (!quoterAddr) {
        // No quoter deployed on this chain — use math fallback
        return getV3QuoteMath(pool, amountIn);
    }

    try {
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
        console.warn(`V3 on-chain quote failed for pool ${pool.address}, using math fallback`);
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
 * V4 Quote — uses the V4 Quoter contract via raw eth_call for accurate quotes.
 * Raw provider.call() bypasses ethers v6 ENS resolution (UNCONFIGURED_NAME errors).
 * Falls back to math-based estimation if the quoter call fails.
 */
async function getV4Quote(provider, pool, amountIn) {
    const quoterAddr = pool.quoterAddr || UNISWAP_V4.quoter;

    if (quoterAddr && pool.useV4Quoter) {
        try {
            const { ethers } = await import('ethers');
            const abiCoder = ethers.AbiCoder.defaultAbiCoder();

            // V4 Quoter quoteExactInputSingle(QuoteExactSingleParams)
            // QuoteExactSingleParams = (PoolKey poolKey, bool zeroForOne, uint128 exactAmount, bytes hookData)
            // Function selector: 0xaa9d21cb
            const encodedParams = abiCoder.encode(
                ['tuple(tuple(address,address,uint24,int24,address),bool,uint128,bytes)'],
                [[
                    [pool.currency0, pool.currency1, pool.fee, pool.tickSpacing, pool.hooks],
                    pool.isToken0In,
                    amountIn,
                    '0x', // hookData
                ]]
            );

            const calldata = '0xaa9d21cb' + encodedParams.slice(2);

            const result = await provider.call({
                to: quoterAddr,
                data: calldata,
            });

            if (!result || result === '0x') {
                return getV3QuoteMath(pool, amountIn);
            }

            // Decode result: (uint256 amountOut, uint256 gasEstimate)
            const decoded = abiCoder.decode(['uint256', 'uint256'], result);
            const amountOut = decoded[0];

            return {
                amountOut,
                priceImpact: 0, // V4 quoter doesn't return price impact directly
                gasEstimate: Number(decoded[1]) || pool.gasEstimate,
            };
        } catch (e) {
            console.warn('V4 Quoter call failed, falling back to math:', e.message);
        }
    }

    // Fallback: use V3-style math (same concentrated liquidity model)
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
