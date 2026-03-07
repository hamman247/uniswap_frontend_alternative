/**
 * Balance Fetcher — queries ETH and ERC-20 token balances for connected wallet
 */
import { TOKENS, NATIVE_ETH } from '../config/tokens.js';
import { ERC20_ABI } from '../config/contracts.js';

/** Cache of balances: address → { raw: bigint, formatted: string } */
const balanceCache = new Map();
let lastFetchAddress = null;

/**
 * Fetch balance for a single token
 * @param {import('ethers').Provider} provider
 * @param {string} walletAddress
 * @param {object} token — token object from tokens.js
 * @returns {Promise<{ raw: bigint, formatted: string }>}
 */
export async function fetchTokenBalance(provider, walletAddress, token) {
    try {
        const { ethers } = await import('ethers');
        let raw;

        if (token.isNative) {
            raw = await provider.getBalance(walletAddress);
        } else {
            const contract = new ethers.Contract(token.address, ERC20_ABI, provider);
            raw = await contract.balanceOf(walletAddress);
        }

        const formatted = formatBalance(raw, token.decimals);
        const entry = { raw, formatted };
        balanceCache.set(token.address.toLowerCase(), entry);
        return entry;
    } catch (e) {
        console.warn(`Failed to fetch balance for ${token.symbol}:`, e.message);
        return { raw: 0n, formatted: '0' };
    }
}

/**
 * Fetch balances for all registered tokens
 * @param {import('ethers').Provider} provider
 * @param {string} walletAddress
 * @param {Array} [tokenList] — optional custom token list (for chain-specific tokens)
 * @returns {Promise<Map<string, { raw: bigint, formatted: string }>>}
 */
export async function fetchAllBalances(provider, walletAddress, tokenList) {
    lastFetchAddress = walletAddress;
    const tokens = tokenList || TOKENS;

    const results = await Promise.allSettled(
        tokens.map(token => fetchTokenBalance(provider, walletAddress, token))
    );

    results.forEach((result, i) => {
        if (result.status === 'fulfilled') {
            balanceCache.set(tokens[i].address.toLowerCase(), result.value);
        }
    });

    return balanceCache;
}

/**
 * Get cached balance for a token
 * @param {string} tokenAddress
 * @returns {{ raw: bigint, formatted: string } | null}
 */
export function getCachedBalance(tokenAddress) {
    return balanceCache.get(tokenAddress.toLowerCase()) || null;
}

/**
 * Get all cached balances
 */
export function getAllCachedBalances() {
    return balanceCache;
}

/**
 * Clear all cached balances
 */
export function clearBalanceCache() {
    balanceCache.clear();
    lastFetchAddress = null;
}

/**
 * Format a raw balance to a human-readable string
 * @param {bigint} raw
 * @param {number} decimals
 * @returns {string}
 */
function formatBalance(raw, decimals) {
    if (raw === 0n) return '0';

    const divisor = 10n ** BigInt(decimals);
    const whole = raw / divisor;
    const remainder = raw % divisor;

    // Build fractional part
    let fracStr = remainder.toString().padStart(decimals, '0');

    // Show meaningful precision
    if (whole > 0n) {
        // For amounts ≥ 1, show up to 4 decimal places
        fracStr = fracStr.slice(0, 4).replace(/0+$/, '');
        const wholeStr = Number(whole).toLocaleString('en-US');
        return fracStr ? `${wholeStr}.${fracStr}` : wholeStr;
    } else {
        // For amounts < 1, show up to 6 meaningful digits
        fracStr = fracStr.slice(0, 6).replace(/0+$/, '');
        return fracStr ? `0.${fracStr}` : '0';
    }
}
