/**
 * Chain Configuration Registry
 *
 * All blockchains with official Uniswap deployments.
 * Each chain entry includes contract addresses, gas bounds, and RPC info.
 *
 * Gas config `minTipWei` / `maxTipWei` are chain-specific bounds for
 * the priority fee (maxPriorityFeePerGas) in the executor.
 */

// ─── Chain Definitions ─────────────────────────────────────────

export const CHAINS = {
    // ═══════════════════ Mainnets ═══════════════════

    1: {
        chainId: 1,
        name: 'Ethereum',
        shortName: 'ETH',
        isTestnet: false,
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpcUrl: 'https://eth.llamarpc.com',
        blockExplorer: 'https://etherscan.io',
        color: '#627eea',
        wethAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        contracts: {
            v2Factory: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
            v2Router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
            v3Factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
            v3Router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
            v3QuoterV2: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
            v4PoolManager: '0x000000000004444c5dc75cB358380D2e3dE08A90',
            v4UniversalRouter: '0x66a9893cc07d91d95644aedd05d03f95e1dba8af',
        },
        gasConfig: { minTipWei: 1_000_000n, maxTipWei: 500_000_000n }, // 0.001–0.5 gwei
        versions: ['V2', 'V3', 'V4'],
    },

    42161: {
        chainId: 42161,
        name: 'Arbitrum One',
        shortName: 'ARB',
        isTestnet: false,
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpcUrl: 'https://arb1.arbitrum.io/rpc',
        blockExplorer: 'https://arbiscan.io',
        color: '#28a0f0',
        wethAddress: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
        contracts: {
            v2Factory: '0xf1D7CC64Fb4452F05c498126312eBE29f30Fbcf9',
            v2Router: '0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24',
            v3Factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
            v3Router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
            v3QuoterV2: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
            v4PoolManager: '0x000000000004444c5dc75cB358380D2e3dE08A90',
            v4UniversalRouter: '0xa51afafe0263b40edaef0df8781ea9aa03e381a3',
        },
        gasConfig: { minTipWei: 100_000n, maxTipWei: 100_000_000n }, // 0.0001–0.1 gwei
        versions: ['V2', 'V3', 'V4'],
    },

    10: {
        chainId: 10,
        name: 'Optimism',
        shortName: 'OP',
        isTestnet: false,
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpcUrl: 'https://mainnet.optimism.io',
        blockExplorer: 'https://optimistic.etherscan.io',
        color: '#ff0420',
        wethAddress: '0x4200000000000000000000000000000000000006',
        contracts: {
            v2Factory: '0x0c3c1c532F1e39EdF36BE9Fe0bE1410313E074Bf',
            v2Router: '0x4A7b5Da61326A6379179b40d00F57E5bbDC962c2',
            v3Factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
            v3Router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
            v3QuoterV2: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
            v4PoolManager: '0x000000000004444c5dc75cB358380D2e3dE08A90',
            v4UniversalRouter: '0x851116DCd5E74627B2C4e0141e1Bed1e9e5ed54e',
        },
        gasConfig: { minTipWei: 1_000n, maxTipWei: 50_000_000n }, // very low L2 tips
        versions: ['V2', 'V3', 'V4'],
    },

    137: {
        chainId: 137,
        name: 'Polygon',
        shortName: 'POL',
        isTestnet: false,
        nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
        rpcUrl: 'https://polygon-rpc.com',
        blockExplorer: 'https://polygonscan.com',
        color: '#8247e5',
        wethAddress: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', // WMATIC
        contracts: {
            v2Factory: '0x9e5A52f57b3038F1B8EeE45F28b3C1967e22799C',
            v2Router: '0xedf6066a2b290C185783862C7F4776A2C8077AD1',
            v3Factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
            v3Router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
            v3QuoterV2: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
            v4PoolManager: '0x000000000004444c5dc75cB358380D2e3dE08A90',
            v4UniversalRouter: '0x1095692a6237d83c6a72f3F5eFeA8Fbc5F8e9547',
        },
        gasConfig: { minTipWei: 1_000_000_000n, maxTipWei: 50_000_000_000n }, // 1–50 gwei (Polygon tips are higher)
        versions: ['V2', 'V3', 'V4'],
    },

    8453: {
        chainId: 8453,
        name: 'Base',
        shortName: 'BASE',
        isTestnet: false,
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpcUrl: 'https://mainnet.base.org',
        blockExplorer: 'https://basescan.org',
        color: '#0052ff',
        wethAddress: '0x4200000000000000000000000000000000000006',
        contracts: {
            v2Factory: '0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6',
            v2Router: '0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24',
            v3Factory: '0x33128a8fC17869897dcE68Ed026d694621f6FDfD',
            v3Router: '0x2626664c2603336E57B271c5C0b26F421741e481',
            v3QuoterV2: '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a',
            v4PoolManager: '0x000000000004444c5dc75cB358380D2e3dE08A90',
            v4UniversalRouter: '0x6fF5693b99212Da76ad316178A184AB56D299b43',
        },
        gasConfig: { minTipWei: 1_000n, maxTipWei: 50_000_000n },
        versions: ['V2', 'V3', 'V4'],
    },

    56: {
        chainId: 56,
        name: 'BNB Chain',
        shortName: 'BSC',
        isTestnet: false,
        nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
        rpcUrl: 'https://bsc-dataseed1.binance.org',
        blockExplorer: 'https://bscscan.com',
        color: '#f0b90b',
        wethAddress: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', // WBNB
        contracts: {
            v2Factory: '0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6',
            v2Router: '0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24',
            v3Factory: '0xdB1d10011AD0Ff90774D0C6Bb92e5C5c8b4461F7',
            v3Router: '0xB971eF87ede563556b2ED4b1C0b0019111Dd85d2',
            v3QuoterV2: '0x78D78E420Da98ad378D7799bE8f4AF69033EB077',
            v4PoolManager: null,
            v4UniversalRouter: null,
        },
        gasConfig: { minTipWei: 100_000_000n, maxTipWei: 3_000_000_000n }, // 0.1–3 gwei
        versions: ['V2', 'V3'],
    },

    43114: {
        chainId: 43114,
        name: 'Avalanche',
        shortName: 'AVAX',
        isTestnet: false,
        nativeCurrency: { name: 'Avalanche', symbol: 'AVAX', decimals: 18 },
        rpcUrl: 'https://api.avax.network/ext/bc/C/rpc',
        blockExplorer: 'https://snowtrace.io',
        color: '#e84142',
        wethAddress: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7', // WAVAX
        contracts: {
            v2Factory: '0x9e5A52f57b3038F1B8EeE45F28b3C1967e22799C',
            v2Router: '0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24',
            v3Factory: '0x740b1c1de25031C31FF4fC9A62f554A55cdC1baD',
            v3Router: '0xbb00FF08d01D300023C629E8fFfFcb65A5a578cE',
            v3QuoterV2: '0xbe0e001A5553000F7f09C10Da3b2b0A1b93e tried',
            v4PoolManager: null,
            v4UniversalRouter: null,
        },
        gasConfig: { minTipWei: 1_000_000_000n, maxTipWei: 5_000_000_000n }, // 1–5 nAVAX
        versions: ['V2', 'V3'],
    },

    81457: {
        chainId: 81457,
        name: 'Blast',
        shortName: 'BLAST',
        isTestnet: false,
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpcUrl: 'https://rpc.blast.io',
        blockExplorer: 'https://blastscan.io',
        color: '#fcfc03',
        wethAddress: '0x4300000000000000000000000000000000000004',
        contracts: {
            v2Factory: null,
            v2Router: null,
            v3Factory: '0x33128a8fC17869897dcE68Ed026d694621f6FDfD',
            v3Router: '0x549FEB8c9bd4c12Ad2AB27022dA12492aC452B66',
            v3QuoterV2: '0x6Cdcd65e03c1CEc3730AeeCd45bc140D57A25C77',
            v4PoolManager: null,
            v4UniversalRouter: null,
        },
        gasConfig: { minTipWei: 1_000n, maxTipWei: 50_000_000n },
        versions: ['V3'],
    },

    324: {
        chainId: 324,
        name: 'ZKSync Era',
        shortName: 'ZK',
        isTestnet: false,
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpcUrl: 'https://mainnet.era.zksync.io',
        blockExplorer: 'https://explorer.zksync.io',
        color: '#8c8dfc',
        wethAddress: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91',
        contracts: {
            v2Factory: null,
            v2Router: null,
            v3Factory: '0x8FdA5a7a8dCA67BBcDd10F02Fa0649A937215422',
            v3Router: '0x99c56385dB8a3e17098425D54e1aEBf401DE695d',
            v3QuoterV2: '0x8Cb537fc92E26d8EBBb760E632c95484b6Ea3e28',
            v4PoolManager: null,
            v4UniversalRouter: null,
        },
        gasConfig: { minTipWei: 1_000_000n, maxTipWei: 250_000_000n },
        versions: ['V3'],
    },

    42220: {
        chainId: 42220,
        name: 'Celo',
        shortName: 'CELO',
        isTestnet: false,
        nativeCurrency: { name: 'Celo', symbol: 'CELO', decimals: 18 },
        rpcUrl: 'https://forno.celo.org',
        blockExplorer: 'https://celoscan.io',
        color: '#35d07f',
        wethAddress: '0x471EcE3750Da237f93B8E339c536989b8978a438', // wrapped CELO
        contracts: {
            v2Factory: '0x79a530c8e2fA8748B7B40dd3629C0520c2cCf03f',
            v2Router: '0x5615CDAb10dc425a742d643d949a7F474C01abc4',
            v3Factory: '0xAfE208a311B21f13EF87E33A90049fC17A7acDEc',
            v3Router: '0x5615CDAb10dc425a742d643d949a7F474C01abc4',
            v3QuoterV2: '0x82825d0554fA07f7FC52Ab63c961F330fdEFa8E8',
            v4PoolManager: null,
            v4UniversalRouter: null,
        },
        gasConfig: { minTipWei: 100_000_000n, maxTipWei: 5_000_000_000n },
        versions: ['V2', 'V3'],
    },

    7777777: {
        chainId: 7777777,
        name: 'Zora',
        shortName: 'ZORA',
        isTestnet: false,
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpcUrl: 'https://rpc.zora.energy',
        blockExplorer: 'https://explorer.zora.energy',
        color: '#a1723a',
        wethAddress: '0x4200000000000000000000000000000000000006',
        contracts: {
            v2Factory: null,
            v2Router: null,
            v3Factory: '0x7145F8aeef1f6510E92164038E1B6F8cB2c42Cbb',
            v3Router: '0x7De04c96BE5159c3b5CeffC82aa176dc81281557',
            v3QuoterV2: '0x11867e1b3348F3ce4FcC170BC5af3d25571E29B3',
            v4PoolManager: null,
            v4UniversalRouter: null,
        },
        gasConfig: { minTipWei: 1_000n, maxTipWei: 50_000_000n },
        versions: ['V3'],
    },

    480: {
        chainId: 480,
        name: 'World Chain',
        shortName: 'WLD',
        isTestnet: false,
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpcUrl: 'https://worldchain-mainnet.g.alchemy.com/public',
        blockExplorer: 'https://worldchain-mainnet.explorer.alchemy.com',
        color: '#00c3b6',
        wethAddress: '0x4200000000000000000000000000000000000006',
        contracts: {
            v2Factory: null,
            v2Router: null,
            v3Factory: '0x7a5028BDa40e7B173C278C5342087826455ea25a',
            v3Router: '0x091AD9e2e6e5eD44c1c66dB50e49A601F9f36cF6',
            v3QuoterV2: '0x10158D43e6cc414deE1Bd1eB0EfC6a5cA5F65F63',
            v4PoolManager: null,
            v4UniversalRouter: null,
        },
        gasConfig: { minTipWei: 1_000n, maxTipWei: 50_000_000n },
        versions: ['V3'],
    },

    // ═══════════════════ Testnets ═══════════════════

    11155111: {
        chainId: 11155111,
        name: 'Sepolia',
        shortName: 'SEP',
        isTestnet: true,
        nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
        rpcUrl: 'https://rpc.sepolia.org',
        blockExplorer: 'https://sepolia.etherscan.io',
        color: '#cfa8ff',
        wethAddress: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
        contracts: {
            v2Factory: '0xB7f907f7A9eBC822a80BD25E224be42Ce0A698A0',
            v2Router: '0xeE567Fe1712Faf6149d80dA1E6934E354124CfE3',
            v3Factory: '0x0227628f3F023bb0B980b67D528571c95c6DaC1c',
            v3Router: '0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E',
            v3QuoterV2: '0xEd1f6473345F45b75F8179591dd5bA1888ff2648',
            v4PoolManager: '0xE03A1074c86CFeDd5C142C4F04F1a1536e203543',
            v4UniversalRouter: '0x3A0e5e3C6D22B28bDB1bAEB1d0Fb55b05F901585',
        },
        gasConfig: { minTipWei: 1_000_000n, maxTipWei: 2_000_000_000n },
        versions: ['V2', 'V3', 'V4'],
    },
};

// ─── ABI fragments (shared across all chains) ──────────────────

export const ABIS = {
    v2Factory: [
        'function getPair(address tokenA, address tokenB) view returns (address)',
    ],
    v2Pair: [
        'function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
        'function token0() view returns (address)',
        'function token1() view returns (address)',
    ],
    v2Router: [
        'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) returns (uint[] memory amounts)',
        'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) payable returns (uint[] memory amounts)',
        'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) returns (uint[] memory amounts)',
        'function getAmountsOut(uint amountIn, address[] calldata path) view returns (uint[] memory amounts)',
        'function WETH() view returns (address)',
    ],
    v3Factory: [
        'function getPool(address tokenA, address tokenB, uint24 fee) view returns (address)',
    ],
    v3Pool: [
        'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
        'function liquidity() view returns (uint128)',
        'function fee() view returns (uint24)',
        'function token0() view returns (address)',
        'function token1() view returns (address)',
        'function tickSpacing() view returns (int24)',
    ],
    v3Quoter: [
        'function quoteExactInputSingle(tuple(address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)',
    ],
    v3Router: [
        'function exactInputSingle(tuple(address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)',
    ],
    v4PoolManager: [
        'function getSlot0(bytes32 poolId) view returns (uint160 sqrtPriceX96, int24 tick, uint16 protocolFee, uint24 lpFee)',
        'function getLiquidity(bytes32 poolId) view returns (uint128)',
    ],
    v4UniversalRouter: [
        'function execute(bytes calldata commands, bytes[] calldata inputs, uint256 deadline) payable',
    ],
    erc20: [
        'function name() view returns (string)',
        'function symbol() view returns (string)',
        'function decimals() view returns (uint8)',
        'function balanceOf(address owner) view returns (uint256)',
        'function allowance(address owner, address spender) view returns (uint256)',
        'function approve(address spender, uint256 value) returns (bool)',
        'function transfer(address to, uint256 value) returns (bool)',
    ],
};

// ─── Helper Functions ──────────────────────────────────────────

/**
 * Standard fee tiers for V3/V4 pools (hundredths of a bip)
 */
export const FEE_TIERS = [100, 500, 3000, 10000];

/**
 * Get a chain config by chain ID
 */
export function getChain(chainId) {
    return CHAINS[chainId] || null;
}

/**
 * Get all mainnet chains
 */
export function getMainnets() {
    return Object.values(CHAINS).filter(c => !c.isTestnet);
}

/**
 * Get all testnet chains
 */
export function getTestnets() {
    return Object.values(CHAINS).filter(c => c.isTestnet);
}

/**
 * Get visible chains based on testnet toggle
 */
export function getVisibleChains(showTestnets = false) {
    return showTestnets ? Object.values(CHAINS) : getMainnets();
}

/**
 * Check if a chain supports a Uniswap version
 */
export function chainSupportsVersion(chainId, version) {
    const chain = CHAINS[chainId];
    return chain ? chain.versions.includes(version) : false;
}
