/**
 * Token Registry
 * Well-known ERC-20 tokens on Ethereum mainnet
 * All tokens include logo URLs from TrustWallet assets CDN
 */

export const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
export const NATIVE_ETH = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

/** TrustWallet CDN base for checksummed token logos */
const TW = (addr) => `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/${addr}/logo.png`;

const TOKEN_COLORS = {
    ETH: '#627eea',
    WETH: '#627eea',
    USDC: '#2775ca',
    USDT: '#26a17b',
    DAI: '#f5ac37',
    WBTC: '#f09242',
    UNI: '#ff007a',
    LINK: '#2a5ada',
    AAVE: '#b6509e',
    MKR: '#1aab9b',
    SNX: '#00d1ff',
    COMP: '#00d395',
    CRV: '#ecd900',
    LDO: '#00a3ff',
    WISE: '#4092e0',
};

export const TOKENS = [
    {
        symbol: 'ETH',
        name: 'Ether',
        address: NATIVE_ETH,
        decimals: 18,
        isNative: true,
        color: TOKEN_COLORS.ETH,
        logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
        popular: true,
    },
    {
        symbol: 'WETH',
        name: 'Wrapped Ether',
        address: WETH_ADDRESS,
        decimals: 18,
        isNative: false,
        color: TOKEN_COLORS.WETH,
        logo: TW('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'),
        popular: true,
    },
    {
        symbol: 'WISE',
        name: 'Wise Token',
        address: '0x66a0f676479Cee1d7373f3DC2e2952778BfF5bd6',
        decimals: 18,
        isNative: false,
        color: TOKEN_COLORS.WISE,
        logo: TW('0x66a0f676479Cee1d7373f3DC2e2952778BfF5bd6'),
        popular: true,
    },
    {
        symbol: 'USDC',
        name: 'USD Coin',
        address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        decimals: 6,
        isNative: false,
        color: TOKEN_COLORS.USDC,
        logo: TW('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'),
        popular: true,
    },
    {
        symbol: 'USDT',
        name: 'Tether USD',
        address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        decimals: 6,
        isNative: false,
        color: TOKEN_COLORS.USDT,
        logo: TW('0xdAC17F958D2ee523a2206206994597C13D831ec7'),
        popular: true,
    },
    {
        symbol: 'DAI',
        name: 'Dai Stablecoin',
        address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
        decimals: 18,
        isNative: false,
        color: TOKEN_COLORS.DAI,
        logo: TW('0x6B175474E89094C44Da98b954EedeAC495271d0F'),
        popular: true,
    },
    {
        symbol: 'WBTC',
        name: 'Wrapped BTC',
        address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
        decimals: 8,
        isNative: false,
        color: TOKEN_COLORS.WBTC,
        logo: TW('0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599'),
        popular: true,
    },
    {
        symbol: 'UNI',
        name: 'Uniswap',
        address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
        decimals: 18,
        isNative: false,
        color: TOKEN_COLORS.UNI,
        logo: TW('0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984'),
        popular: true,
    },
    {
        symbol: 'LINK',
        name: 'Chainlink',
        address: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
        decimals: 18,
        isNative: false,
        color: TOKEN_COLORS.LINK,
        logo: TW('0x514910771AF9Ca656af840dff83E8264EcF986CA'),
        popular: true,
    },
    {
        symbol: 'AAVE',
        name: 'Aave',
        address: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9',
        decimals: 18,
        isNative: false,
        color: TOKEN_COLORS.AAVE,
        logo: TW('0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9'),
        popular: false,
    },
    {
        symbol: 'MKR',
        name: 'Maker',
        address: '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2',
        decimals: 18,
        isNative: false,
        color: TOKEN_COLORS.MKR,
        logo: TW('0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2'),
        popular: false,
    },
    {
        symbol: 'SNX',
        name: 'Synthetix',
        address: '0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F',
        decimals: 18,
        isNative: false,
        color: TOKEN_COLORS.SNX,
        logo: TW('0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F'),
        popular: false,
    },
    {
        symbol: 'COMP',
        name: 'Compound',
        address: '0xc00e94Cb662C3520282E6f5717214004A7f26888',
        decimals: 18,
        isNative: false,
        color: TOKEN_COLORS.COMP,
        logo: TW('0xc00e94Cb662C3520282E6f5717214004A7f26888'),
        popular: false,
    },
    {
        symbol: 'CRV',
        name: 'Curve DAO',
        address: '0xD533a949740bb3306d119CC777fa900bA034cd52',
        decimals: 18,
        isNative: false,
        color: TOKEN_COLORS.CRV,
        logo: TW('0xD533a949740bb3306d119CC777fa900bA034cd52'),
        popular: false,
    },
    {
        symbol: 'LDO',
        name: 'Lido DAO',
        address: '0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32',
        decimals: 18,
        isNative: false,
        color: TOKEN_COLORS.LDO,
        logo: TW('0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32'),
        popular: false,
    },
];

/**
 * Get token by symbol
 */
export function getTokenBySymbol(symbol) {
    return TOKENS.find(t => t.symbol.toLowerCase() === symbol.toLowerCase());
}

/**
 * Get token by address
 */
export function getTokenByAddress(address) {
    return TOKENS.find(t => t.address.toLowerCase() === address.toLowerCase());
}

/**
 * Get the effective address for routing (native → wrapped)
 */
export function getRoutingAddress(token, chainId = 1) {
    if (token.isNative) {
        return getWethForChain(chainId);
    }
    return token.address;
}

/**
 * Get WETH/wrapped native address for a chain (imported dynamically to avoid circular deps)
 */
function getWethForChain(chainId) {
    const wethMap = {
        1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        42161: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
        10: '0x4200000000000000000000000000000000000006',
        137: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
        8453: '0x4200000000000000000000000000000000000006',
        56: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
        43114: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
        81457: '0x4300000000000000000000000000000000000004',
        324: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91',
        42220: '0x471EcE3750Da237f93B8E339c536989b8978a438',
        7777777: '0x4200000000000000000000000000000000000006',
        480: '0x4200000000000000000000000000000000000006',
        11155111: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
    };
    return wethMap[chainId] || WETH_ADDRESS;
}

/**
 * Render a token icon HTML string.
 */
export function renderTokenIcon(token, size = 28) {
    if (token.logo) {
        return `<div class="token-icon" style="width:${size}px;height:${size}px;background:${token.color || '#555'};">
      <img src="${token.logo}" alt="${token.symbol}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" />
      <span class="token-icon-fallback" style="display:none;">${token.symbol.charAt(0)}</span>
    </div>`;
    }
    return `<div class="token-icon" style="width:${size}px;height:${size}px;background:${token.color || '#555'}; color: white; font-weight: 700;">${token.symbol.charAt(0)}</div>`;
}

// ─── Chain-Specific Default Tokens ─────────────────────────────

const N = (sym, name, dec, col, pop = true) => ({
    symbol: sym, name, address: NATIVE_ETH, decimals: dec, isNative: true,
    color: col, logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png', popular: pop,
});

const T = (sym, name, addr, dec, col, chain = 'ethereum', pop = true) => ({
    symbol: sym, name, address: addr, decimals: dec, isNative: false,
    color: col, logo: `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${chain}/assets/${addr}/logo.png`, popular: pop,
});

export const CHAIN_TOKENS = {
    // Ethereum (already in TOKENS, re-export pointer)
    1: null, // use TOKENS

    42161: [ // Arbitrum
        N('ETH', 'Ether', 18, '#627eea'),
        T('USDC', 'USD Coin', '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', 6, '#2775ca', 'arbitrum'),
        T('USDT', 'Tether USD', '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', 6, '#26a17b', 'arbitrum'),
        T('WBTC', 'Wrapped BTC', '0x2f2a2543B76A4166549F7aaB2e75Bef0aeFc5B0f', 8, '#f09242', 'arbitrum'),
        T('ARB', 'Arbitrum', '0x912CE59144191C1204E64559FE8253a0e49E6548', 18, '#28a0f0', 'arbitrum'),
        T('UNI', 'Uniswap', '0xFa7F8980b0f1E64A2062791cc3b0871572f1F7f0', 18, '#ff007a', 'arbitrum'),
        T('LINK', 'Chainlink', '0xf97f4df75117a78c1A5a0DBb814Af92458539FB4', 18, '#2a5ada', 'arbitrum'),
        T('DAI', 'Dai', '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', 18, '#f5ac37', 'arbitrum'),
    ],

    10: [ // Optimism
        N('ETH', 'Ether', 18, '#627eea'),
        T('USDC', 'USD Coin', '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', 6, '#2775ca', 'optimism'),
        T('USDT', 'Tether USD', '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', 6, '#26a17b', 'optimism'),
        T('OP', 'Optimism', '0x4200000000000000000000000000000000000042', 18, '#ff0420', 'optimism'),
        T('WBTC', 'Wrapped BTC', '0x68f180fcCe6836688e9084f035309E29Bf0A2095', 8, '#f09242', 'optimism'),
        T('DAI', 'Dai', '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', 18, '#f5ac37', 'optimism'),
        T('UNI', 'Uniswap', '0x6fd9d7AD17242c41f7131d257212c54A0e816691', 18, '#ff007a', 'optimism'),
        T('LINK', 'Chainlink', '0x350a791Bfc2C21F9Ed5d10980Dad2e2638ffa7f6', 18, '#2a5ada', 'optimism'),
    ],

    137: [ // Polygon
        { symbol: 'MATIC', name: 'Polygon', address: NATIVE_ETH, decimals: 18, isNative: true, color: '#8247e5', logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png', popular: true },
        T('USDC', 'USD Coin', '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', 6, '#2775ca', 'polygon'),
        T('USDT', 'Tether USD', '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', 6, '#26a17b', 'polygon'),
        T('WBTC', 'Wrapped BTC', '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6', 8, '#f09242', 'polygon'),
        T('DAI', 'Dai', '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', 18, '#f5ac37', 'polygon'),
        T('UNI', 'Uniswap', '0xb33EaAd8d922B1083446DC23f610c2567fB5180f', 18, '#ff007a', 'polygon'),
        T('AAVE', 'Aave', '0xD6DF932A45C0f255f85145f286eA0b292B21C90B', 18, '#b6509e', 'polygon'),
        T('LINK', 'Chainlink', '0x53E0bca35eC356BD5ddDFebbD1Fc0fD03FaBad39', 18, '#2a5ada', 'polygon'),
    ],

    8453: [ // Base
        N('ETH', 'Ether', 18, '#627eea'),
        T('USDC', 'USD Coin', '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', 6, '#2775ca', 'base'),
        T('DAI', 'Dai', '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', 18, '#f5ac37', 'base'),
        T('AERO', 'Aerodrome', '0x940181a94A35A4569E4529A3CDfB74e38FD98631', 18, '#0052ff', 'base'),
        T('cbETH', 'Coinbase ETH', '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22', 18, '#0052ff', 'base'),
    ],

    56: [ // BNB Chain
        { symbol: 'BNB', name: 'BNB', address: NATIVE_ETH, decimals: 18, isNative: true, color: '#f0b90b', logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/binance/info/logo.png', popular: true },
        T('USDT', 'Tether USD', '0x55d398326f99059fF775485246999027B3197955', 18, '#26a17b', 'smartchain'),
        T('USDC', 'USD Coin', '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', 18, '#2775ca', 'smartchain'),
        T('BTCB', 'Bitcoin BEP2', '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c', 18, '#f09242', 'smartchain'),
        T('ETH', 'Ether', '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', 18, '#627eea', 'smartchain'),
        T('CAKE', 'PancakeSwap', '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82', 18, '#d1884f', 'smartchain'),
    ],

    43114: [ // Avalanche
        { symbol: 'AVAX', name: 'Avalanche', address: NATIVE_ETH, decimals: 18, isNative: true, color: '#e84142', logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/avalanchec/info/logo.png', popular: true },
        T('USDC', 'USD Coin', '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', 6, '#2775ca', 'avalanchec'),
        T('USDT', 'Tether USD', '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7', 6, '#26a17b', 'avalanchec'),
        T('WBTC', 'Wrapped BTC', '0x50b7545627a5162F82A992c33b87aDc75187B218', 8, '#f09242', 'avalanchec'),
    ],

    81457: [ // Blast
        N('ETH', 'Ether', 18, '#627eea'),
        T('USDB', 'USDB', '0x4300000000000000000000000000000000000003', 18, '#fcfc03', 'blast'),
        T('BLAST', 'Blast', '0xb1a5700fA2358173Fe465e6eA4Ff52E36e88E2ad', 18, '#fcfc03', 'blast'),
    ],

    324: [ // ZKSync Era
        N('ETH', 'Ether', 18, '#627eea'),
        T('USDC', 'USD Coin', '0x1d17CBcF0D6D143135aE902365D2E5e2A16538D4', 6, '#2775ca', 'zksync'),
    ],

    42220: [ // Celo
        { symbol: 'CELO', name: 'Celo', address: NATIVE_ETH, decimals: 18, isNative: true, color: '#35d07f', logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/celo/info/logo.png', popular: true },
        T('cUSD', 'Celo Dollar', '0x765DE816845861e75A25fCA122bb6898B8B1282a', 18, '#45cd85', 'celo'),
        T('cEUR', 'Celo Euro', '0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73', 18, '#35d07f', 'celo'),
    ],

    7777777: [ // Zora
        N('ETH', 'Ether', 18, '#627eea'),
    ],

    480: [ // World Chain
        N('ETH', 'Ether', 18, '#627eea'),
        T('WLD', 'Worldcoin', '0x2cFc85d8E48F8EAB294be644d9E25C3030863003', 18, '#00c3b6', 'worldchain'),
    ],

    11155111: [ // Sepolia testnet
        N('ETH', 'Sepolia Ether', 18, '#627eea'),
        T('USDC', 'Test USDC', '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', 6, '#2775ca', 'ethereum'),
    ],
};

/**
 * Get the token list for a specific chain
 */
export function getTokensForChain(chainId = 1) {
    if (chainId === 1 || !CHAIN_TOKENS[chainId]) {
        return TOKENS;
    }
    return CHAIN_TOKENS[chainId];
}

/**
 * Get the default trading pair for a chain (first two tokens)
 */
export function getDefaultPair(chainId = 1) {
    const tokens = getTokensForChain(chainId);
    return {
        tokenIn: tokens[0],
        tokenOut: tokens.length > 1 ? tokens[1] : tokens[0],
    };
}

