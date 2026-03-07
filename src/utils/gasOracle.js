/**
 * Gas Price Oracle — fetches live gas prices from the connected provider
 *
 * Caches the result for a short period to avoid hammering the RPC.
 */

let cachedGasPrice = null;  // in wei (bigint)
let lastFetchTime = 0;
const CACHE_TTL_MS = 15_000; // 15 second cache

/**
 * Get the current gas price from the provider (wei).
 * Falls back to a sensible default if no provider.
 *
 * @param {import('ethers').Provider|null} provider
 * @returns {Promise<bigint>} gas price in wei
 */
export async function getGasPrice(provider) {
    const now = Date.now();

    // Return cached value if fresh enough
    if (cachedGasPrice && (now - lastFetchTime) < CACHE_TTL_MS) {
        return cachedGasPrice;
    }

    if (!provider) {
        // No provider — return a conservative 10 gwei default
        return 10_000_000_000n;
    }

    try {
        const feeData = await provider.getFeeData();

        // Use maxFeePerGas (EIP-1559) if available, otherwise gasPrice (legacy)
        const price = feeData.maxFeePerGas || feeData.gasPrice || 10_000_000_000n;

        cachedGasPrice = price;
        lastFetchTime = now;
        return price;
    } catch (e) {
        console.warn('Failed to fetch gas price, using cached or default:', e.message);
        return cachedGasPrice || 10_000_000_000n;
    }
}

/**
 * Get gas price in gwei (number, for display)
 * @param {import('ethers').Provider|null} provider
 * @returns {Promise<number>}
 */
export async function getGasPriceGwei(provider) {
    const priceWei = await getGasPrice(provider);
    return Number(priceWei) / 1e9;
}

/**
 * Estimate the USD cost of gas for a given gas limit
 * @param {import('ethers').Provider|null} provider
 * @param {number} gasLimit
 * @param {number} ethUsdPrice
 * @returns {Promise<{ costEth: number, costUsd: number, gasPriceGwei: number }>}
 */
export async function estimateGasCostUsd(provider, gasLimit, ethUsdPrice = 3150) {
    const priceWei = await getGasPrice(provider);
    const costWei = priceWei * BigInt(gasLimit);
    const costEth = Number(costWei) / 1e18;
    const costUsd = costEth * ethUsdPrice;
    const gasPriceGwei = Number(priceWei) / 1e9;

    return { costEth, costUsd, gasPriceGwei };
}

/**
 * Clear the gas price cache (e.g. on network change)
 */
export function clearGasPriceCache() {
    cachedGasPrice = null;
    lastFetchTime = 0;
}
