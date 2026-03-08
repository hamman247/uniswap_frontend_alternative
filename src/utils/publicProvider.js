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
 * Note: ENS is explicitly disabled to avoid UNCONFIGURED_NAME errors
 * on public RPCs that don't support ENS resolution.
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

        // Build a FetchRequest with the RPC URL
        const fetchReq = new ethers.FetchRequest(chain.rpcUrl);
        fetchReq.timeout = 15000; // 15s timeout

        // Create a static Network with no ENS support
        // This prevents the UNCONFIGURED_NAME error that happens when
        // ethers tries to resolve contract addresses via ENS on public RPCs
        const network = ethers.Network.from(id);

        const provider = new ethers.JsonRpcProvider(fetchReq, network, {
            staticNetwork: network,
            batchMaxCount: 1,
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
