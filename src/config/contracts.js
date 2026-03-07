/**
 * Contract Configuration — chain-aware
 *
 * Re-exports ABIs and contract addresses from chains.js.
 * Provides backwards-compatible access for modules that import from here.
 */
import { CHAINS, ABIS, getChain, FEE_TIERS } from './chains.js';

// ─── Fee Configuration ─────────────────────────────────────────
export const FEE_CONFIG = {
    /** Fee in basis points (currently 0 — set > 0 to enable) */
    feeBps: 0,
    /** Fee recipient address — set this to your own address */
    feeRecipient: '0x000000000000000000000000000000000000dEaD',
};

// ─── Chain-aware accessors ─────────────────────────────────────

/** Current chain state — set by main.js on connect/switch */
let _currentChainId = 1;

export function setCurrentChainId(chainId) {
    _currentChainId = chainId;
}

export function getCurrentChainId() {
    return _currentChainId;
}

export function getCurrentChain() {
    return getChain(_currentChainId);
}

/**
 * Get contract addresses for a specific chain
 */
export function getContracts(chainId = _currentChainId) {
    const chain = getChain(chainId);
    return chain ? chain.contracts : null;
}

/**
 * Get WETH (or wrapped native) address for the current chain
 */
export function getWethAddress(chainId = _currentChainId) {
    const chain = getChain(chainId);
    return chain ? chain.wethAddress : '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
}

/**
 * Get gas config for a chain
 */
export function getGasConfig(chainId = _currentChainId) {
    const chain = getChain(chainId);
    return chain ? chain.gasConfig : { minTipWei: 1_000_000n, maxTipWei: 500_000_000n };
}

// ─── Re-exports for backwards compatibility ────────────────────

export const ERC20_ABI = ABIS.erc20;

/** @deprecated — use getContracts() instead */
export const UNISWAP_V2 = {
    get factory() { return getContracts().v2Factory; },
    get router() { return getContracts().v2Router; },
    factoryAbi: ABIS.v2Factory,
    pairAbi: ABIS.v2Pair,
    routerAbi: ABIS.v2Router,
};

/** @deprecated — use getContracts() instead */
export const UNISWAP_V3 = {
    get factory() { return getContracts().v3Factory; },
    get router() { return getContracts().v3Router; },
    get quoterV2() { return getContracts().v3QuoterV2; },
    feeTiers: FEE_TIERS,
    factoryAbi: ABIS.v3Factory,
    poolAbi: ABIS.v3Pool,
    quoterAbi: ABIS.v3Quoter,
    routerAbi: ABIS.v3Router,
};

/** @deprecated — use getContracts() instead */
export const UNISWAP_V4 = {
    get poolManager() { return getContracts().v4PoolManager; },
    get universalRouter() { return getContracts().v4UniversalRouter; },
    feeTiers: FEE_TIERS,
    poolManagerAbi: ABIS.v4PoolManager,
    universalRouterAbi: ABIS.v4UniversalRouter,
};

export const MULTICALL3_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11';
export const MULTICALL3_ABI = [
    'function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) payable returns (tuple(bool success, bytes returnData)[] returnData)',
];
