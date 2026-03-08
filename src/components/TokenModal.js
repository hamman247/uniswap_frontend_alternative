/**
 * Token Selection Modal
 * Supports searching predefined tokens AND importing custom tokens by address.
 */
import { TOKENS, renderTokenIcon } from '../config/tokens.js';
import { ERC20_ABI } from '../config/contracts.js';
import { ICONS } from './icons.js';
import { getCachedBalance } from '../utils/balances.js';
import { walletConnect } from './WalletConnect.js';

/** Current chain's token list (set by main.js) */
let chainTokens = TOKENS;

/** Session-level storage for user-imported custom tokens */
const customTokens = [];

/**
 * Resolve a token by address — checks predefined list first, then custom imports
 */
function findToken(address) {
  const addr = address.toLowerCase();
  return (
    chainTokens.find(t => t.address.toLowerCase() === addr) ||
    customTokens.find(t => t.address.toLowerCase() === addr)
  );
}

/**
 * Get the combined list of all known tokens
 */
function allTokens() {
  return [...chainTokens, ...customTokens];
}

export class TokenModal {
  constructor({ onSelect }) {
    this.onSelect = onSelect;
    this.currentDisabled = null;
    this.element = null;
    this._lookupDebounce = null;
    this._isLookingUp = false;
  }

  render() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'token-modal';
    overlay.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title">Select a token</h2>
          <button class="modal-close-btn" id="token-modal-close">${ICONS.close}</button>
        </div>

        <div class="modal-search">
          <input type="text" id="token-search-input" placeholder="Search by name or paste address" autocomplete="off" />
        </div>

        <div class="popular-tokens" id="popular-tokens"></div>

        <div id="custom-token-result"></div>

        <div class="token-list" id="token-list"></div>
      </div>
    `;

    this.element = overlay;
    this._renderPopularTokens();
    this._renderTokenList(chainTokens);
    this._bindEvents();
    return overlay;
  }

  _renderPopularTokens() {
    const container = this.element.querySelector('#popular-tokens');
    const popular = chainTokens.filter(t => t.popular);

    container.innerHTML = popular.map(t => `
      <button class="popular-token-chip" data-address="${t.address}">
        ${renderTokenIcon(t, 24)}
        <span class="token-symbol-text">${t.symbol}</span>
      </button>
    `).join('');
  }

  _renderTokenList(tokens) {
    const list = this.element.querySelector('#token-list');
    list.innerHTML = tokens.map(t => {
      const isDisabled = this.currentDisabled &&
        t.address.toLowerCase() === this.currentDisabled.toLowerCase();

      const balance = getCachedBalance(t.address);
      const balanceDisplay = balance ? balance.formatted : '';
      const isCustom = t._isCustom ? true : false;

      return `
        <div class="token-list-item ${isDisabled ? 'disabled' : ''}"
             data-address="${t.address}"
             ${isDisabled ? 'data-disabled="true"' : ''}>
          ${renderTokenIcon(t, 36)}
          <div class="token-list-info">
            <div class="token-list-name">${t.symbol}${isCustom ? ' <span style="font-size:9px;color:var(--accent-orange);font-weight:400;">(imported)</span>' : ''}</div>
            <div class="token-list-full-name">${t.name}</div>
          </div>
          <div class="token-list-balance">
            <div class="token-list-balance-amount">${balanceDisplay || '-'}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  _bindEvents() {
    // Close
    this.element.querySelector('#token-modal-close').addEventListener('click', () => this.close());
    this.element.addEventListener('click', (e) => {
      if (e.target === this.element) this.close();
    });

    // Search with address detection
    this.element.querySelector('#token-search-input').addEventListener('input', (e) => {
      const query = e.target.value.trim();
      this._handleSearchInput(query);
    });

    // Token selection
    this._bindTokenClicks();
  }

  _handleSearchInput(query) {
    const customResult = this.element.querySelector('#custom-token-result');

    // Check if input looks like an Ethereum address
    if (this._isEthAddress(query)) {
      // Check if we already know this token
      const known = findToken(query);
      if (known) {
        this._renderTokenList([known]);
        this._bindTokenClicks();
        customResult.innerHTML = '';
        return;
      }

      // Unknown address — look it up on-chain
      clearTimeout(this._lookupDebounce);
      this._lookupDebounce = setTimeout(() => this._lookupToken(query), 300);
      return;
    }

    // Normal text search
    customResult.innerHTML = '';
    const lowerQuery = query.toLowerCase();
    const all = allTokens();
    const filtered = lowerQuery
      ? all.filter(t =>
        t.symbol.toLowerCase().includes(lowerQuery) ||
        t.name.toLowerCase().includes(lowerQuery) ||
        t.address.toLowerCase().includes(lowerQuery)
      )
      : all;
    this._renderTokenList(filtered);
    this._bindTokenClicks();
  }

  /**
   * Look up an unknown token by its contract address
   */
  async _lookupToken(address) {
    const customResult = this.element.querySelector('#custom-token-result');
    const list = this.element.querySelector('#token-list');

    // Show loading state
    this._isLookingUp = true;
    list.innerHTML = '';
    customResult.innerHTML = `
      <div class="custom-token-loading">
        <div class="route-loading-spinner"></div>
        <span>Looking up token at ${address.slice(0, 6)}...${address.slice(-4)}</span>
      </div>
    `;

    try {
      // Use wallet provider if available, otherwise fall back to public RPC
      let provider = walletConnect.provider;
      if (!provider) {
        const { getPublicProvider } = await import('../utils/publicProvider.js');
        provider = await getPublicProvider();
      }
      if (!provider) {
        customResult.innerHTML = `
          <div class="custom-token-error">Unable to connect to network — please try again</div>
        `;
        this._isLookingUp = false;
        return;
      }

      const { ethers } = await import('ethers');
      const contract = new ethers.Contract(address, ERC20_ABI, provider);

      const [name, symbol, decimals] = await Promise.all([
        contract.name().catch(() => 'Unknown Token'),
        contract.symbol().catch(() => '???'),
        contract.decimals().catch(() => 18),
      ]);

      // Verify it's actually a token (symbol should exist)
      if (symbol === '???' || !symbol) {
        customResult.innerHTML = `
          <div class="custom-token-error">No valid ERC-20 token found at this address</div>
        `;
        this._isLookingUp = false;
        return;
      }

      // Generate a color from the address
      const color = this._addressToColor(address);

      const newToken = {
        symbol: symbol,
        name: name,
        address: address,
        decimals: Number(decimals),
        isNative: false,
        color: color,
        popular: false,
        _isCustom: true,
      };

      // Save to session custom tokens (avoid duplicates)
      if (!customTokens.find(t => t.address.toLowerCase() === address.toLowerCase())) {
        customTokens.push(newToken);
      }

      // Show the found token with an import prompt
      customResult.innerHTML = `
        <div class="custom-token-found" id="custom-token-import" data-address="${address}">
          ${renderTokenIcon(newToken, 36)}
          <div class="token-list-info">
            <div class="token-list-name">${symbol}</div>
            <div class="token-list-full-name">${name}</div>
          </div>
          <button class="import-token-btn">Import</button>
        </div>
      `;

      // Bind import click
      const importBtn = customResult.querySelector('#custom-token-import');
      importBtn.addEventListener('click', () => {
        if (this.onSelect) {
          this.onSelect(newToken);
          this.close();
        }
      });

    } catch (err) {
      console.warn('Token lookup failed:', err.message);
      customResult.innerHTML = `
        <div class="custom-token-error">Could not resolve token — verify the address is correct</div>
      `;
    }

    this._isLookingUp = false;
  }

  _bindTokenClicks() {
    this.element.querySelectorAll('.token-list-item:not([data-disabled])').forEach(item => {
      item.addEventListener('click', () => {
        const address = item.dataset.address;
        const token = findToken(address);
        if (token && this.onSelect) {
          this.onSelect(token);
          this.close();
        }
      });
    });

    this.element.querySelectorAll('.popular-token-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const address = chip.dataset.address;
        if (this.currentDisabled && address.toLowerCase() === this.currentDisabled.toLowerCase()) return;
        const token = findToken(address);
        if (token && this.onSelect) {
          this.onSelect(token);
          this.close();
        }
      });
    });
  }

  open(disabledAddress = null) {
    this.currentDisabled = disabledAddress;
    this._renderTokenList(allTokens());
    this._bindTokenClicks();
    this.element.classList.add('open');
    const input = this.element.querySelector('#token-search-input');
    input.value = '';
    this.element.querySelector('#custom-token-result').innerHTML = '';
    setTimeout(() => input.focus(), 100);
  }

  /**
   * Update the token list for a new chain
   */
  setChainTokens(tokens) {
    chainTokens = tokens;
    this._renderPopularTokens();
    this._renderTokenList(allTokens());
  }

  close() {
    this.element.classList.remove('open');
  }

  /**
   * Check if string is a valid Ethereum address
   */
  _isEthAddress(str) {
    return /^0x[a-fA-F0-9]{40}$/.test(str);
  }

  /**
   * Generate a deterministic color from an address
   */
  _addressToColor(address) {
    const hash = address.slice(2, 8);
    const r = parseInt(hash.slice(0, 2), 16);
    const g = parseInt(hash.slice(2, 4), 16);
    const b = parseInt(hash.slice(4, 6), 16);
    // Ensure the color is not too dark
    const minBrightness = 80;
    const adjust = (c) => Math.max(minBrightness, c);
    return `rgb(${adjust(r)}, ${adjust(g)}, ${adjust(b)})`;
  }

  /**
   * Try to get a fallback provider (e.g. from window.ethereum even without full connect)
   */
  _getFallbackProvider() {
    if (typeof window.ethereum !== 'undefined') {
      try {
        // Dynamic import not needed — ethers already loaded
        const { ethers } = window;
        if (ethers) return new ethers.BrowserProvider(window.ethereum);
      } catch { }
    }
    return null;
  }
}
