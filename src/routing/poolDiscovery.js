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

    // 1. Discover direct AND multi-hop routes in parallel
    //    The optimizer's greedy split will pick the best combination
    const [directPools, multiHopPools] = await Promise.all([
        discoverDirectPools(provider, addressIn, addressOut, chainId),
        discoverMultiHopPools(provider, addressIn, addressOut, chainId),
    ]);

    const allPools = [...directPools, ...multiHopPools];

    if (allPools.length > 0) {
        console.log(`Found ${directPools.length} direct + ${multiHopPools.length} multi-hop pool(s)`);
        return allPools;
    }

    // 2. Fallback: ask the Uniswap Routing API for a route
    console.log('On-chain discovery failed, trying Uniswap Routing API...');
    const apiPools = await discoverViaUniswapAPI(tokenIn, tokenOut, chainId);
    return apiPools;
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
 * Creates multi-hop route descriptors for ALL combinations of
 * leg1 and leg2 pools so the optimizer can pick the best.
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
                // Generate multi-hop routes for all combinations of leg1 × leg2 pools
                // Cap at top 3 per leg to keep it reasonable
                const topLeg1 = leg1Pools.slice(0, 3);
                const topLeg2 = leg2Pools.slice(0, 3);

                for (const l1 of topLeg1) {
                    for (const l2 of topLeg2) {
                        multiHopPools.push({
                            version: `${l1.version}→${l2.version}`,
                            isMultiHop: true,
                            intermediary: bridge,
                            leg1: l1,
                            leg2: l2,
                            tokenIn: addressIn,
                            tokenOut: addressOut,
                            fee: l1.fee + l2.fee,
                            feeLabel: `${((l1.fee + l2.fee) / 10000).toFixed(2)}%`,
                            gasEstimate: l1.gasEstimate + l2.gasEstimate,
                        });
                    }
                }
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
 * Discover Uniswap V4 pools.
 *
 * Two strategies:
 *  1. Event log scanning: scan PoolManager `Initialize` events for pools
 *     that contain the target tokens (finds pools with custom hooks)
 *  2. Quoter brute-force: try common fee/tickSpacing/hooks combos via the quoter
 *     (fast but can't find pools with custom hooks)
 *
 * Key V4 differences:
 *  - V4 uses address(0) for native ETH, not WETH
 *  - V4 supports dynamic fees (0x800000 flag)
 *  - V4 tick spacing is set per-pool, not derived from fee
 */

// Cache discovered V4 pool keys to avoid repeated log scanning
const v4PoolKeyCache = new Map();

// ─── localStorage cache helpers for V4 pools ───
const V4_CACHE_PREFIX = 'wiseswap_v4_pools_';
const V4_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function loadCachedV4Pools(cacheKey) {
    try {
        const raw = localStorage.getItem(V4_CACHE_PREFIX + cacheKey);
        if (!raw) return null;
        const cached = JSON.parse(raw);
        if (Date.now() - cached.ts > V4_CACHE_TTL_MS) {
            localStorage.removeItem(V4_CACHE_PREFIX + cacheKey);
            return null;
        }
        // Restore BigInt values
        return cached.pools.map(p => ({
            ...p,
            amountIn: BigInt(p.amountIn),
            amountOut: BigInt(p.amountOut),
            sqrtPriceX96: BigInt(p.sqrtPriceX96 || '0'),
            liquidity: BigInt(p.liquidity || '1'),
        }));
    } catch { return null; }
}

function saveCachedV4Pools(cacheKey, pools) {
    try {
        // Convert BigInt to strings for JSON serialization
        const serializable = pools.map(p => ({
            ...p,
            amountIn: p.amountIn.toString(),
            amountOut: p.amountOut.toString(),
            sqrtPriceX96: (p.sqrtPriceX96 || 0n).toString(),
            liquidity: (p.liquidity || 1n).toString(),
        }));
        localStorage.setItem(V4_CACHE_PREFIX + cacheKey, JSON.stringify({
            ts: Date.now(),
            pools: serializable,
        }));
    } catch { /* localStorage full or unavailable */ }
}

async function discoverV4Pools(provider, tokenIn, tokenOut) {
    const quoterAddr = UNISWAP_V4.quoter;
    const poolManagerAddr = UNISWAP_V4.poolManager;
    if (!quoterAddr || !poolManagerAddr) return [];

    const { ethers } = await import('ethers');
    const chainId = getCurrentChainId();
    const chain = getChain(chainId);
    const wethAddr = chain?.wethAddress;

    // Normalize token addresses for comparison
    const tokIn = tokenIn.toLowerCase();
    const tokOut = tokenOut.toLowerCase();
    const weth = wethAddr?.toLowerCase();

    // Build localStorage cache key
    const sortedPair = [tokIn, tokOut].sort().join('-');
    const cacheKey = `${chainId}-${sortedPair}`;

    // ─── Check localStorage cache first (instant) ───
    const cached = loadCachedV4Pools(cacheKey);
    if (cached && cached.length > 0) {
        console.log(`V4: ${cached.length} pool(s) from cache`);
        return cached;
    }

    // ─── Parallel brute-force: probe all fee/tickSpacing combos at once ───
    // Standard V3-compatible tiers
    const feeTickCombos = [
        { fee: 100, tickSpacing: 1 },
        { fee: 500, tickSpacing: 10 },
        { fee: 3000, tickSpacing: 60 },
        { fee: 10000, tickSpacing: 200 },
        // Free (fee=0) pools
        { fee: 0, tickSpacing: 1 },
        { fee: 0, tickSpacing: 10 },
        { fee: 0, tickSpacing: 60 },
        { fee: 0, tickSpacing: 200 },
        // Dynamic fee (0x800000) pools
        { fee: 8388608, tickSpacing: 1 },
        { fee: 8388608, tickSpacing: 10 },
        { fee: 8388608, tickSpacing: 60 },
        { fee: 8388608, tickSpacing: 200 },
        // Non-standard fee tiers seen in the wild
        { fee: 2000, tickSpacing: 40 },
        { fee: 5000, tickSpacing: 100 },
        { fee: 20000, tickSpacing: 400 },
        { fee: 50000, tickSpacing: 100 },
        { fee: 50000, tickSpacing: 1000 },
        { fee: 96000, tickSpacing: 1920 },   // e.g. ELEVATE
        { fee: 100000, tickSpacing: 200 },
        { fee: 100000, tickSpacing: 2000 },
        // Wide tickSpacing variants
        { fee: 3000, tickSpacing: 1 },
        { fee: 10000, tickSpacing: 60 },
        { fee: 500, tickSpacing: 1 },
        // Dynamic fee with wider tick spacings
        { fee: 8388608, tickSpacing: 100 },
        { fee: 8388608, tickSpacing: 400 },
        { fee: 8388608, tickSpacing: 1000 },
        { fee: 8388608, tickSpacing: 1920 },
    ];

    // Build all token pair variants (include native ETH if applicable)
    const tokenPairs = [[tokenIn, tokenOut]];
    if (wethAddr) {
        if (tokIn === weth) tokenPairs.push([ZERO_ADDRESS, tokenOut]);
        if (tokOut === weth) tokenPairs.push([tokenIn, ZERO_ADDRESS]);
    }

    // Fire ALL probes in parallel — typically ~24 eth_call RPCs
    const testAmount = 1000000000000000n; // 0.001 ETH
    const queries = [];
    for (const [tIn, tOut] of tokenPairs) {
        for (const { fee, tickSpacing } of feeTickCombos) {
            queries.push(
                tryV4Quoter(ethers, provider, quoterAddr, tIn, tOut, fee, tickSpacing, testAmount, tokenIn, tokenOut)
            );
        }
    }

    const results = await Promise.allSettled(queries);
    const pools = [];
    for (const r of results) {
        if (r.status === 'fulfilled' && r.value) {
            pools.push(r.value);
        }
    }

    // Deduplicate by fee+tickSpacing+hooks+currencies
    const seen = new Set();
    const deduped = pools.filter(p => {
        const key = `${p.fee}-${p.tickSpacing}-${p.currency0}-${p.currency1}-${p.hooks}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    // Save to localStorage for instant future lookups
    if (deduped.length > 0) {
        console.log(`V4: found ${deduped.length} pool(s), caching`);
        saveCachedV4Pools(cacheKey, deduped);
    }

    return deduped;
}

/**
 * Scan PoolManager Initialize events to discover V4 pools for a token pair.
 * Scans in reverse chronological order (newest first) in small batches.
 */
async function scanV4InitializeEvents(ethers, provider, poolManagerAddr, tokenInAddrs, tokenOutAddrs, chainId) {
    const poolKeys = [];
    const INIT_SIG = ethers.id('Initialize(bytes32,address,address,uint24,int24,address,uint160,int24)');
    const abiCoder = ethers.AbiCoder.defaultAbiCoder();

    try {
        const headBlock = await provider.getBlockNumber();
        const launchBlock = V4_LAUNCH_BLOCKS[chainId] || (headBlock - 500000);
        const BATCH_SIZE = 49000;
        const MAX_CONCURRENT = 6;

        // Initialize event:
        //   topics[0] = event sig
        //   topics[1] = id (bytes32 indexed)
        //   topics[2] = currency0 (address indexed)
        //   topics[3] = currency1 (address indexed)
        //   data = (uint24 fee, int24 tickSpacing, address hooks, uint160 sqrtPriceX96, int24 tick)

        // Build padded topic values for filtering
        // We can filter by currency0 or currency1 in topics[2] or topics[3]
        const allTokenAddrs = [...tokenInAddrs, ...tokenOutAddrs];
        const paddedAddrs = allTokenAddrs.map(a => ethers.zeroPadValue(a, 32));

        // Build batch ranges
        const batches = [];
        for (let to = headBlock; to >= launchBlock; to -= BATCH_SIZE) {
            const from = Math.max(to - BATCH_SIZE + 1, launchBlock);
            batches.push({ from, to });
        }

        console.log(`V4 scanning ${batches.length} block ranges for ${allTokenAddrs.length} token addresses...`);

        // For each token address, query events where it appears as currency0 (topic[2]) or currency1 (topic[3])
        const processBatch = async (batch) => {
            const found = [];
            try {
                // Query with one of our token addresses as currency0
                for (const padAddr of paddedAddrs) {
                    try {
                        const logs = await provider.getLogs({
                            address: poolManagerAddr,
                            topics: [INIT_SIG, null, padAddr, null],
                            fromBlock: batch.from,
                            toBlock: batch.to,
                        });
                        for (const log of logs) {
                            const pk = parseInitializeLog(ethers, abiCoder, log, tokenInAddrs, tokenOutAddrs);
                            if (pk) found.push(pk);
                        }
                    } catch { /* skip */ }

                    try {
                        // Query with the address as currency1
                        const logs2 = await provider.getLogs({
                            address: poolManagerAddr,
                            topics: [INIT_SIG, null, null, padAddr],
                            fromBlock: batch.from,
                            toBlock: batch.to,
                        });
                        for (const log of logs2) {
                            const pk = parseInitializeLog(ethers, abiCoder, log, tokenInAddrs, tokenOutAddrs);
                            if (pk) found.push(pk);
                        }
                    } catch { /* skip */ }
                }
            } catch (e) {
                // On block range error, split
                if (e.message?.includes('block range') && (batch.to - batch.from) > 10000) {
                    const mid = Math.floor((batch.from + batch.to) / 2);
                    const results = await Promise.allSettled([
                        processBatch({ from: batch.from, to: mid }),
                        processBatch({ from: mid + 1, to: batch.to }),
                    ]);
                    for (const r of results) {
                        if (r.status === 'fulfilled') found.push(...r.value);
                    }
                }
            }
            return found;
        };

        // Fire batches with concurrency limit
        for (let i = 0; i < batches.length; i += MAX_CONCURRENT) {
            const chunk = batches.slice(i, i + MAX_CONCURRENT);
            const results = await Promise.allSettled(chunk.map(processBatch));
            for (const r of results) {
                if (r.status === 'fulfilled') {
                    poolKeys.push(...r.value);
                }
            }
            // Early exit if we found pools
            if (poolKeys.length > 0) break;
        }
    } catch (e) {
        console.warn('V4 event scanning failed:', e.message);
    }

    return poolKeys;
}

/**
 * Parse a PoolManager Initialize event log into a pool key descriptor.
 * Returns null if the log doesn't match the expected token pair.
 */
function parseInitializeLog(ethers, abiCoder, log, tokenInAddrs, tokenOutAddrs) {
    try {
        // Extract currencies from indexed topics
        const currency0 = ethers.getAddress('0x' + log.topics[2].slice(26)); // strip 0x + 24 zeros
        const currency1 = ethers.getAddress('0x' + log.topics[3].slice(26));
        const c0 = currency0.toLowerCase();
        const c1 = currency1.toLowerCase();

        // Verify this pool matches our token pair
        const hasTokenIn = tokenInAddrs.has(c0) || tokenInAddrs.has(c1);
        const hasTokenOut = tokenOutAddrs.has(c0) || tokenOutAddrs.has(c1);

        if (!hasTokenIn || !hasTokenOut) return null;

        // Decode non-indexed data: (uint24 fee, int24 tickSpacing, address hooks, uint160 sqrtPriceX96, int24 tick)
        const decoded = abiCoder.decode(
            ['uint24', 'int24', 'address', 'uint160', 'int24'],
            log.data
        );

        return {
            currency0,
            currency1,
            fee: Number(decoded[0]),
            tickSpacing: Number(decoded[1]),
            hooks: decoded[2],
            sqrtPriceX96: decoded[3],
            tick: Number(decoded[4]),
        };
    } catch {
        return null;
    }
}

/**
 * Try to discover a V4 pool by quoting via raw eth_call.
 *
 * Uses provider.call() directly instead of Contract.staticCall
 * to avoid ethers v6 ENS resolution issues (UNCONFIGURED_NAME error).
 */
async function tryV4Quoter(ethers, provider, quoterAddr, rawTokenIn, rawTokenOut, fee, tickSpacing, testAmount, originalTokenIn, originalTokenOut, hooksAddr) {
    // Sort tokens for canonical ordering (required for PoolKey)
    const [currency0, currency1] = rawTokenIn.toLowerCase() < rawTokenOut.toLowerCase()
        ? [rawTokenIn, rawTokenOut]
        : [rawTokenOut, rawTokenIn];

    const zeroForOne = rawTokenIn.toLowerCase() === currency0.toLowerCase();
    const hooks = hooksAddr || ZERO_ADDRESS;

    try {
        const abiCoder = ethers.AbiCoder.defaultAbiCoder();

        // V4 Quoter quoteExactInputSingle(QuoteExactSingleParams)
        // QuoteExactSingleParams = (PoolKey poolKey, bool zeroForOne, uint128 exactAmount, bytes hookData)
        // PoolKey = (Currency currency0, Currency currency1, uint24 fee, int24 tickSpacing, IHooks hooks)
        // Function selector: 0xaa9d21cb
        const encodedParams = abiCoder.encode(
            [
                'tuple(tuple(address,address,uint24,int24,address),bool,uint128,bytes)',
            ],
            [
                [
                    [currency0, currency1, fee, tickSpacing, hooks], // poolKey
                    zeroForOne,
                    testAmount,
                    '0x', // hookData
                ],
            ]
        );

        const calldata = '0xaa9d21cb' + encodedParams.slice(2);

        // Use raw provider.call() to bypass ethers Contract address resolution
        const result = await provider.call({
            to: quoterAddr,
            data: calldata,
        });

        if (!result || result === '0x') return null;

        // Decode result: (uint256 amountOut, uint256 gasEstimate)
        const decoded = abiCoder.decode(['uint256', 'uint256'], result);
        const amountOut = decoded[0];
        const gasEstimateResult = Number(decoded[1]);

        if (amountOut > 0n) {
            // Build fee label
            let feeLabel;
            if (fee === 0) feeLabel = 'Free';
            else if (fee === 8388608) feeLabel = 'Dynamic';
            else feeLabel = `${(fee / 10000).toFixed(2)}%`;

            console.log(`V4 pool found! fee=${fee} ts=${tickSpacing} hooks=${hooks.slice(0, 14)}... amountOut=${amountOut.toString()}`);

            return {
                version: 'V4',
                poolId: `v4-${currency0}-${currency1}-${fee}-${tickSpacing}`,
                tokenIn: originalTokenIn,
                tokenOut: originalTokenOut,
                fee,
                feeLabel,
                sqrtPriceX96: 0n,
                tick: 0,
                liquidity: 1n,
                tickSpacing,
                hooks,
                currency0,
                currency1,
                isToken0In: zeroForOne,
                gasEstimate: gasEstimateResult || 200000,
                useV4Quoter: true,
                quoterAddr,
            };
        }
    } catch (e) {
        // Log failures for event-discovered pools (non-zero hooks) or first few brute-force probes
        if (hooks !== ZERO_ADDRESS) {
            console.warn(`V4 quoter probe FAILED (hooks=${hooks.slice(0, 14)}... fee=${fee} ts=${tickSpacing}): ${e.code || 'no-code'}, ${e.message?.slice(0, 100)}`);
        } else if (fee === 3000 && tickSpacing === 60) {
            console.warn(`V4 quoter probe failed (fee=3000): ${e.code || 'no-code'}, msg: ${e.message?.slice(0, 120)}`);
        }
    }

    return null;
}

/**
 * Standard tick spacing for fee tier (V3 compatibility)
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

/**
 * Fallback: discover routes via the Uniswap Routing API.
 * This handles V4 pools with custom hooks that can't be discovered by brute-force.
 *
 * The API endpoint is the same one used by the official Uniswap app.
 */
async function discoverViaUniswapAPI(tokenIn, tokenOut, chainId) {
    try {
        const tokenInAddr = tokenIn.address === 'NATIVE'
            ? '0x0000000000000000000000000000000000000000'
            : tokenIn.address;
        const tokenOutAddr = tokenOut.address === 'NATIVE'
            ? '0x0000000000000000000000000000000000000000'
            : tokenOut.address;

        // Use a reasonable test amount for discovery
        const testAmountRaw = tokenIn.decimals
            ? (10n ** BigInt(tokenIn.decimals) / 1000n).toString() // 0.001 of token
            : '1000000000000000'; // 0.001 ETH

        const requestBody = {
            tokenInChainId: chainId,
            tokenOutChainId: chainId,
            tokenIn: tokenInAddr,
            tokenOut: tokenOutAddr,
            amount: testAmountRaw,
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
            console.warn('Uniswap API returned', response.status);
            return [];
        }

        const data = await response.json();

        // Parse the classic quote response
        const classic = data.quote || data;
        if (!classic || !classic.route) {
            return [];
        }

        // Extract pool descriptors from the route
        const pools = [];
        for (const routeGroup of classic.route) {
            for (const step of routeGroup) {
                const pool = parseApiPoolStep(step, tokenIn, tokenOut);
                if (pool) pools.push(pool);
            }
        }

        if (pools.length > 0) {
            console.log(`Found ${pools.length} pool(s) via Uniswap API`);
            // For API-discovered routes, mark them so the quoter uses the API for quoting too
            pools.forEach(p => { p.useApiQuote = true; });
        }

        return pools;
    } catch (e) {
        console.warn('Uniswap API fallback failed:', e.message);
        return [];
    }
}

/**
 * Parse a pool step from the Uniswap API response into our pool descriptor format
 */
function parseApiPoolStep(step, tokenIn, tokenOut) {
    try {
        const type = step.type;

        if (type === 'v2-pool') {
            return {
                version: 'V2',
                address: step.address,
                tokenIn: tokenIn.address,
                tokenOut: tokenOut.address,
                fee: 3000, // V2 always 0.3%
                feeLabel: '0.30%',
                reserves: [BigInt(step.reserve0?.quotient || '0'), BigInt(step.reserve1?.quotient || '0')],
                gasEstimate: 150000,
            };
        }

        if (type === 'v3-pool') {
            return {
                version: 'V3',
                address: step.address,
                tokenIn: tokenIn.address,
                tokenOut: tokenOut.address,
                fee: Number(step.fee || 3000),
                feeLabel: `${(Number(step.fee || 3000) / 10000).toFixed(2)}%`,
                sqrtPriceX96: BigInt(step.sqrtRatioX96 || '0'),
                tick: Number(step.tick || 0),
                liquidity: BigInt(step.liquidity || '0'),
                tickSpacing: Number(step.tickSpacing || 60),
                gasEstimate: 180000,
            };
        }

        if (type === 'v4-pool') {
            const hooks = step.hooks || '0x0000000000000000000000000000000000000000';
            const fee = Number(step.fee || 0);
            const tickSpacing = Number(step.tickSpacing || 60);
            const currency0 = (step.token0?.address || step.currency0 || '').toLowerCase();
            const currency1 = (step.token1?.address || step.currency1 || '').toLowerCase();

            return {
                version: 'V4',
                poolId: step.poolId || step.address || '',
                tokenIn: tokenIn.address,
                tokenOut: tokenOut.address,
                fee,
                feeLabel: fee === 0 ? 'Free' : fee === 8388608 ? 'Dynamic' : `${(fee / 10000).toFixed(2)}%`,
                sqrtPriceX96: BigInt(step.sqrtRatioX96 || step.sqrtPriceX96 || '0'),
                tick: Number(step.tick || 0),
                liquidity: BigInt(step.liquidity || '1'),
                tickSpacing,
                hooks,
                currency0,
                currency1,
                isToken0In: tokenIn.address.toLowerCase() === currency0,
                gasEstimate: 200000,
                useV4Quoter: true,
                useApiQuote: true,
                quoterAddr: UNISWAP_V4.quoter,
            };
        }

        return null;
    } catch (e) {
        return null;
    }
}

