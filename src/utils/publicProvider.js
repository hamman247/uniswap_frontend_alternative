/**
 * Public Provider — creates a read-only JsonRpcProvider from the chain's public RPC.
 * Used for pool discovery and quoting when no wallet is connected.
 */
import { getChain, CHAINS } from '../config/chains.js';
import { getCurrentChainId } from '../config/contracts.js';

/** Cache providers to avoid creating a new one every query */
const providerCache = new Map();

/**
 * Get a read-only provider for the given chain (or current chain).
 * Returns null if the chain has no RPC URL configured.
 *
 * @param {number} [chainId] — defaults to the current chain
 * @returns {Promise<import('ethers').JsonRpcProvider | null>}
 */
export async function getPublicProvider(chainId) {
    const id = chainId || getCurrentChainId();
    const chain = getChain(id);
    if (!chain || !chain.rpcUrl) return null;

    if (providerCache.has(id)) {
        return providerCache.get(id);
    }

    try {
        const { ethers } = await import('ethers');
        const provider = new ethers.JsonRpcProvider(chain.rpcUrl, id, {
            staticNetwork: true,
            batchMaxCount: 1,  // Public RPCs often don't support batching
        });
        providerCache.set(id, provider);
        return provider;
    } catch (e) {
        console.warn(`Failed to create public provider for chain ${id}:`, e.message);
        return null;
    }
}

/**
 * Clear cached providers (e.g. on chain switch)
 */
export function clearProviderCache() {
    providerCache.clear();
}
