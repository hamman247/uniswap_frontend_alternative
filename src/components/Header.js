/**
 * Header Component — Logo, navigation, chain selector, and wallet
 */
import { getVisibleChains, getChain, CHAINS } from '../config/chains.js';
import { t } from '../i18n/i18n.js';

export class Header {
  constructor({ onConnectWallet, onChainSelect, onNavSwap, onNavLeaderboard }) {
    this.onConnectWallet = onConnectWallet;
    this.onChainSelect = onChainSelect;
    this.onNavSwap = onNavSwap;
    this.onNavLeaderboard = onNavLeaderboard;
    this.walletAddress = null;
    this.currentChainId = 1;
    this.showTestnets = localStorage.getItem('wiseswap_testnets') === 'true';
    this.chainDropdownOpen = false;
    this.element = null;
  }

  render() {
    const header = document.createElement('header');
    header.className = 'header';
    header.innerHTML = `
      <a class="header-logo" href="/">
        <img src="/owl-logo.jpg" alt="WiseSwap" class="header-logo-img" />
        <span class="header-logo-text">WiseSwap</span>
      </a>

      <nav class="header-nav">
        <button class="header-nav-item active" id="nav-swap">${t('swap')}</button>
        <a class="header-nav-item" href="https://app.uniswap.org/positions/create?currencyA=NATIVE&currencyB=0x66a0f676479Cee1d7373f3DC2e2952778BfF5bd6&chain=ethereum&fee={%22isDynamic%22:false,%22feeAmount%22:100,%22tickSpacing%22:1}&hook=undefined&priceRangeState={%22priceInverted%22:false,%22fullRange%22:false,%22initialPrice%22:%22%22,%22inputMode%22:%22price%22}&depositState={%22exactField%22:%22TOKEN0%22,%22exactAmounts%22:{}}&step=0" target="_blank" rel="noopener noreferrer">${t('pools')}</a>
      </nav>

      <div class="header-actions">
        <div class="chain-selector" id="chain-selector">
          <button class="chain-selector-btn" id="chain-selector-btn">
            <span class="chain-dot" id="chain-dot" style="background: ${CHAINS[this.currentChainId]?.color || '#627eea'}"></span>
            <span class="chain-name" id="chain-name">${CHAINS[this.currentChainId]?.shortName || 'ETH'}</span>
            <svg class="chain-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </button>
          <div class="chain-dropdown" id="chain-dropdown">
            ${this._renderChainList()}
          </div>
        </div>
        <button class="btn-connect" id="wallet-connect-btn">
          <span id="wallet-btn-text">${t('connect')}</span>
        </button>
      </div>
    `;

    this.element = header;
    this._bindEvents();
    return header;
  }

  _renderChainList() {
    const chains = getVisibleChains(this.showTestnets);
    return chains.map(chain => {
      const logoUrl = this._getChainLogo(chain);
      return `
      <button class="chain-option ${chain.chainId === this.currentChainId ? 'active' : ''} ${chain.isTestnet ? 'testnet' : ''}"
              data-chain-id="${chain.chainId}">
        <img class="chain-option-logo" src="${logoUrl}" alt="${chain.shortName}"
             onerror="this.style.display='none';this.nextElementSibling.style.display='inline-block';" />
        <span class="chain-dot chain-dot-fallback" style="background: ${chain.color}; display: none;"></span>
        <span class="chain-option-name">${chain.name}</span>
        ${chain.isTestnet ? '<span class="chain-testnet-badge">Testnet</span>' : ''}
      </button>
    `;
    }).join('');
  }

  _getChainLogo(chain) {
    const logos = {
      1: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
      42161: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/info/logo.png',
      10: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/optimism/info/logo.png',
      137: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png',
      8453: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/info/logo.png',
      56: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/binance/info/logo.png',
      43114: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/avalanchec/info/logo.png',
      81457: 'https://icons.llamao.fi/icons/chains/rsz_blast.jpg',
      324: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/zksync/info/logo.png',
      42220: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/celo/info/logo.png',
      7777777: 'https://icons.llamao.fi/icons/chains/rsz_zora.jpg',
      480: 'https://icons.llamao.fi/icons/chains/rsz_worldchain.jpg',
      369: 'https://tokens.app.pulsex.com/images/tokens/0xA1077a294dDE1B09bB078844df40758a5D0f9a27.png',
      11155111: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
    };
    return logos[chain.chainId] || '';
  }

  _bindEvents() {
    // Wallet connect
    this.element.querySelector('#wallet-connect-btn').addEventListener('click', () => {
      if (this.onConnectWallet) this.onConnectWallet();
    });

    // Nav: Swap
    this.element.querySelector('#nav-swap')?.addEventListener('click', () => {
      this._setActiveNav('nav-swap');
      this.onNavSwap?.();
    });

    // Nav: Leaderboard
    this.element.querySelector('#nav-leaderboard')?.addEventListener('click', () => {
      this._setActiveNav('nav-leaderboard');
      this.onNavLeaderboard?.();
    });

    // Chain selector toggle
    this.element.querySelector('#chain-selector-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.chainDropdownOpen = !this.chainDropdownOpen;
      this.element.querySelector('#chain-dropdown').classList.toggle('open', this.chainDropdownOpen);
    });

    // Chain option clicks
    this.element.querySelector('#chain-dropdown').addEventListener('click', (e) => {
      const option = e.target.closest('.chain-option');
      if (!option) return;
      const chainId = parseInt(option.dataset.chainId);
      this._selectChain(chainId);
    });

    // Close dropdown on outside click
    document.addEventListener('click', () => {
      if (this.chainDropdownOpen) {
        this.chainDropdownOpen = false;
        const dd = this.element?.querySelector('#chain-dropdown');
        if (dd) dd.classList.remove('open');
      }
    });
  }

  _selectChain(chainId) {
    this.currentChainId = chainId;
    this.chainDropdownOpen = false;

    const chain = getChain(chainId);
    if (chain) {
      this.element.querySelector('#chain-dot').style.background = chain.color;
      this.element.querySelector('#chain-name').textContent = chain.shortName;
      this.element.querySelector('#chain-dropdown').classList.remove('open');

      // Update active state
      this.element.querySelectorAll('.chain-option').forEach(opt => {
        opt.classList.toggle('active', parseInt(opt.dataset.chainId) === chainId);
      });

      if (this.onChainSelect) this.onChainSelect(chainId);
    }
  }

  _setActiveNav(activeId) {
    this.element?.querySelectorAll('.header-nav-item').forEach(item => {
      item.classList.toggle('active', item.id === activeId);
    });
  }

  /** Refresh chain list when testnet visibility changes */
  updateTestnetVisibility(showTestnets) {
    this.showTestnets = showTestnets;
    const dropdown = this.element?.querySelector('#chain-dropdown');
    if (dropdown) {
      dropdown.innerHTML = this._renderChainList();
    }
  }

  /** Called when wallet reports a chain change */
  setChain(chainId) {
    const chain = getChain(chainId);
    if (!chain) return;

    this.currentChainId = chainId;
    const dot = this.element?.querySelector('#chain-dot');
    const name = this.element?.querySelector('#chain-name');
    if (dot) dot.style.background = chain.color;
    if (name) name.textContent = chain.shortName;

    // Update active in dropdown
    this.element?.querySelectorAll('.chain-option').forEach(opt => {
      opt.classList.toggle('active', parseInt(opt.dataset.chainId) === chainId);
    });
  }

  updateWallet(address) {
    this.walletAddress = address;
    const btn = this.element.querySelector('#wallet-connect-btn');
    const text = this.element.querySelector('#wallet-btn-text');

    if (address) {
      const short = `${address.slice(0, 6)}...${address.slice(-4)}`;
      text.textContent = short;
      btn.classList.add('connected');
    } else {
      text.textContent = t('connectWallet');
      btn.classList.remove('connected');
    }
  }

  updateNetwork(name) {
    // Replaced by chain selector
  }
}
