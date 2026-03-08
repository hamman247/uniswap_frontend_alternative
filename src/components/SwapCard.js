/**
 * SwapCard Component — The main swap interface
 */
import { ICONS } from './icons.js';
import { TOKENS, getTokenBySymbol, renderTokenIcon } from '../config/tokens.js';
import { feeManager } from '../fees/feeManager.js';
import { findOptimalRoute } from '../routing/optimizer.js';
import { discoverPools } from '../routing/poolDiscovery.js';
import { getCachedBalance } from '../utils/balances.js';
import { estimateGasCostUsd } from '../utils/gasOracle.js';
import { t } from '../i18n/i18n.js';

export class SwapCard {
  constructor({ onSwap, onSelectToken, onOpenSettings, routeVisualizer, getProvider, getSlippage }) {
    this.onSwap = onSwap;
    this.onSelectToken = onSelectToken;
    this.onOpenSettings = onOpenSettings;
    this.routeVisualizer = routeVisualizer;
    this.getProvider = getProvider; // () => provider | null
    this.getSlippage = getSlippage; // () => slippage percentage (e.g. 0.5)

    this.tokenIn = getTokenBySymbol('ETH');
    this.tokenOut = getTokenBySymbol('WISE');
    this.amountIn = '';
    this.amountOut = '';
    this.currentRoute = null;
    this.isLoading = false;
    this.debounceTimer = null;

    this.element = null;
  }

  render() {
    const card = document.createElement('div');
    card.className = 'swap-card animate-fade-in-up';
    card.id = 'swap-card';

    card.innerHTML = `
      <div class="swap-card-header">
        <span class="swap-card-title" data-i18n="swap">${t('swap')}</span>
        <button class="swap-card-settings-btn" id="swap-settings-btn" title="${t('settings')}">
          ${ICONS.settings}
        </button>
      </div>

      <!-- Token In -->
      <div class="token-input-wrapper" id="input-wrapper-in">
        <div class="token-input-label">
          <span class="token-input-label-text" data-i18n="youPay">${t('youPay')}</span>
          <span class="token-input-balance-group">
            <span id="balance-in">${t('balance')}: —</span>
            <button class="max-btn" id="max-btn">MAX</button>
          </span>
        </div>
        <div class="token-input-row">
          <input
            type="text"
            inputmode="decimal"
            class="token-amount-input"
            id="amount-input-in"
            placeholder="0"
            autocomplete="off"
          />
          <button class="token-selector-btn" id="token-selector-in">
            ${this._renderTokenButton(this.tokenIn)}
          </button>
        </div>
        <div class="token-usd-value" id="usd-value-in"></div>
      </div>

      <!-- Swap Direction -->
      <div class="swap-direction-container">
        <button class="swap-direction-btn" id="swap-direction-btn">
          ${ICONS.swap}
        </button>
      </div>

      <!-- Token Out -->
      <div class="token-input-wrapper" id="input-wrapper-out">
        <div class="token-input-label">
          <span class="token-input-label-text" data-i18n="youReceive">${t('youReceive')}</span>
          <span class="token-input-balance" id="balance-out">${t('balance')}: —</span>
        </div>
        <div class="token-input-row">
          <input
            type="text"
            inputmode="decimal"
            class="token-amount-input"
            id="amount-input-out"
            placeholder="0"
            readonly
          />
          <button class="token-selector-btn" id="token-selector-out">
            ${this._renderTokenButton(this.tokenOut)}
          </button>
        </div>
        <div class="token-usd-value" id="usd-value-out"></div>
      </div>

      <!-- Info Section -->
      <div class="swap-info" id="swap-info" style="display: none;">
        <div class="swap-info-row">
          <span class="swap-info-label" data-i18n="rate">
            ${t('rate')}
          </span>
          <span class="swap-info-value" id="swap-rate">—</span>
        </div>
        <div class="swap-info-divider"></div>
        <div class="swap-info-row">
          <span class="swap-info-label" data-i18n="interfaceFee">
            ${t('interfaceFee')}
            <span class="info-icon tooltip" data-tooltip="${t('feeTooltip')}">?</span>
          </span>
          <span class="swap-info-value" id="swap-fee">—</span>
        </div>
        <div class="swap-info-row">
          <span class="swap-info-label" data-i18n="priceImpact">${t('priceImpact')}</span>
          <span class="swap-info-value" id="swap-impact">—</span>
        </div>
        <div class="swap-info-row">
          <span class="swap-info-label" data-i18n="minReceived">${t('minReceived')}</span>
          <span class="swap-info-value" id="swap-min-received">—</span>
        </div>
        <div class="swap-info-row">
          <span class="swap-info-label" data-i18n="networkCost">${t('networkCost')}</span>
          <span class="swap-info-value" id="swap-gas">—</span>
        </div>
      </div>

      <!-- Submit Button -->
      <button class="swap-submit-btn disabled" id="swap-submit-btn">
        ${t('enterAmount')}
      </button>
    `;

    this.element = card;
    this._bindEvents();
    return card;
  }

  _renderTokenButton(token) {
    if (!token) {
      return `
        <span class="token-symbol-text" style="color: white;">${t('selectToken')}</span>
        <svg class="token-selector-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      `;
    }
    return `
      ${renderTokenIcon(token, 28)}
      <span class="token-symbol-text">${token.symbol}</span>
      <svg class="token-selector-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M6 9l6 6 6-6"/>
      </svg>
    `;
  }

  _bindEvents() {
    // Amount input with debounce
    this.element.querySelector('#amount-input-in').addEventListener('input', (e) => {
      // Allow only valid number input
      let value = e.target.value.replace(/[^0-9.]/g, '');
      // Prevent multiple dots
      const parts = value.split('.');
      if (parts.length > 2) value = parts[0] + '.' + parts.slice(1).join('');
      e.target.value = value;
      this.amountIn = value;

      // Debounced route calculation
      clearTimeout(this.debounceTimer);
      if (value && parseFloat(value) > 0) {
        this.debounceTimer = setTimeout(() => this._calculateRoute(), 400);
      } else {
        this._clearOutput();
      }
    });

    // Settings
    this.element.querySelector('#swap-settings-btn').addEventListener('click', () => {
      if (this.onOpenSettings) this.onOpenSettings();
    });

    // Swap direction
    this.element.querySelector('#swap-direction-btn').addEventListener('click', () => {
      this._swapTokens();
    });

    // Token selectors
    this.element.querySelector('#token-selector-in').addEventListener('click', () => {
      if (this.onSelectToken) {
        this.onSelectToken('in', this.tokenOut?.address);
      }
    });

    this.element.querySelector('#token-selector-out').addEventListener('click', () => {
      if (this.onSelectToken) {
        this.onSelectToken('out', this.tokenIn?.address);
      }
    });

    // Max button
    this.element.querySelector('#max-btn').addEventListener('click', () => {
      this._setMaxAmount();
    });

    // Submit
    this.element.querySelector('#swap-submit-btn').addEventListener('click', () => {
      if (this.currentRoute && this.onSwap) {
        // Check balance before swapping
        const bal = getCachedBalance(this.tokenIn.address);
        if (bal && this.amountIn) {
          const { ethers } = window._ethersLib || {};
          const inputRaw = this.currentRoute.totalAmountIn;
          if (inputRaw > bal.raw) {
            // Show inline notification via the swap card
            this._showBalanceError();
            return;
          }
        }
        this.onSwap(this.currentRoute, this.tokenIn, this.tokenOut);
      }
    });
  }

  _setMaxAmount() {
    if (!this.tokenIn) return;
    const bal = getCachedBalance(this.tokenIn.address);
    if (!bal || bal.raw === 0n) return;

    // For native ETH, leave a small amount for gas
    let raw = bal.raw;
    if (this.tokenIn.isNative) {
      const gasBuffer = BigInt(1e15); // 0.001 ETH for gas
      raw = raw > gasBuffer ? raw - gasBuffer : 0n;
    }

    const amount = Number(raw) / (10 ** this.tokenIn.decimals);
    const display = amount < 1 ? amount.toFixed(6) : amount.toFixed(this.tokenIn.decimals <= 6 ? 2 : 6);

    this.amountIn = display;
    this.element.querySelector('#amount-input-in').value = display;

    clearTimeout(this.debounceTimer);
    if (amount > 0) {
      this._calculateRoute();
    }
  }

  _swapTokens() {
    const tempToken = this.tokenIn;
    this.tokenIn = this.tokenOut;
    this.tokenOut = tempToken;

    // Update UI
    this.element.querySelector('#token-selector-in').innerHTML = this._renderTokenButton(this.tokenIn);
    this.element.querySelector('#token-selector-out').innerHTML = this._renderTokenButton(this.tokenOut);
    this.updateBalances();

    // Recalculate if there's an amount
    if (this.amountIn && parseFloat(this.amountIn) > 0) {
      this._calculateRoute();
    } else {
      this._clearOutput();
    }
  }

  setToken(side, token) {
    if (side === 'in') {
      this.tokenIn = token;
      this.element.querySelector('#token-selector-in').innerHTML = this._renderTokenButton(token);
    } else {
      this.tokenOut = token;
      this.element.querySelector('#token-selector-out').innerHTML = this._renderTokenButton(token);
    }

    this.updateBalances();

    // Recalculate
    if (this.amountIn && parseFloat(this.amountIn) > 0) {
      this._calculateRoute();
    }
  }

  /**
   * Update displayed balances from the cache
   */
  updateBalances() {
    if (this.tokenIn) {
      const balIn = getCachedBalance(this.tokenIn.address);
      const el = this.element.querySelector('#balance-in');
      el.textContent = balIn ? `${t('balance')}: ${balIn.formatted}` : `${t('balance')}: —`;
    }
    if (this.tokenOut) {
      const balOut = getCachedBalance(this.tokenOut.address);
      const el = this.element.querySelector('#balance-out');
      el.textContent = balOut ? `${t('balance')}: ${balOut.formatted}` : `${t('balance')}: —`;
    }
  }

  async _calculateRoute() {
    if (!this.tokenIn || !this.tokenOut || !this.amountIn || parseFloat(this.amountIn) <= 0) {
      this._clearOutput();
      return;
    }

    this.isLoading = true;
    this._updateSubmitButton('loading', t('findingRoute'));
    if (this.routeVisualizer) this.routeVisualizer.showLoading();

    try {
      const amountInNum = parseFloat(this.amountIn);
      const rawAmountIn = BigInt(Math.floor(amountInNum * (10 ** this.tokenIn.decimals)));

      // ─── Wrap/Unwrap detection ───
      // If the pair is native ↔ wrapped (ETH↔WETH, BNB↔WBNB, etc.),
      // return a 1:1 route instantly — no pool discovery needed.
      const { getCurrentChainId } = await import('../config/contracts.js');
      const { isWrapUnwrap } = await import('../config/tokens.js');
      const chainId = getCurrentChainId();
      const wrapCheck = isWrapUnwrap(this.tokenIn, this.tokenOut, chainId);

      if (wrapCheck.isWrapUnwrap) {
        const action = wrapCheck.isWrap ? 'Wrap' : 'Unwrap';
        const route = {
          routes: [{
            pool: { version: 'WRAP', fee: 0, feeLabel: '0%', tokenIn: this.tokenIn.address, tokenOut: this.tokenOut.address },
            amountIn: rawAmountIn,
            amountOut: rawAmountIn, // 1:1 ratio
            percentage: 100,
            priceImpact: 0,
            gasEstimate: 45000,
          }],
          totalAmountIn: rawAmountIn,
          totalAmountAfterFee: rawAmountIn,
          totalAmountOut: rawAmountIn, // 1:1
          feeAmount: 0n,
          priceImpact: 0,
          totalGas: 45000,
          effectivePrice: '1.00000',
          isWrapUnwrap: true,
        };

        this.currentRoute = route;
        this.amountOut = amountInNum.toFixed(this.tokenOut.decimals <= 6 ? 2 : 6);
        this.element.querySelector('#amount-input-out').value = this._formatAmountDisplay(amountInNum);
        this._updateInfoSection(route, amountInNum, amountInNum);
        if (this.routeVisualizer) this.routeVisualizer.update(route);

        const walletProvider = this.getProvider ? this.getProvider() : null;
        this._updateSubmitButton(walletProvider ? 'ready' : 'ready', walletProvider ? action : `${t('connectWallet')}`);
        this.isLoading = false;
        return;
      }

      // Use wallet provider if connected, otherwise use public RPC
      let provider = this.getProvider ? this.getProvider() : null;
      let isReadOnly = false;

      if (!provider) {
        // No wallet — use public RPC for read-only price discovery
        const { getPublicProvider } = await import('../utils/publicProvider.js');
        provider = await getPublicProvider();
        isReadOnly = true;
      }

      let route;

      if (provider) {
        // == REAL ROUTING: discover pools on-chain, then optimize ==
        this._updateSubmitButton('loading', 'Discovering pools...');
        const pools = await discoverPools(provider, this.tokenIn, this.tokenOut);

        if (pools.length === 0) {
          this._updateSubmitButton('disabled', 'No path found for token trading');
          this._clearOutput();
          this.isLoading = false;
          return;
        } else {
          this._updateSubmitButton('loading', `Optimizing across ${pools.length} pools...`);
          route = await findOptimalRoute(provider, pools, rawAmountIn, this.tokenIn.decimals, this.tokenOut.decimals);
        }
      } else {
        // == FALLBACK: both wallet and public RPC unavailable ==
        console.warn('No provider available');
        this._updateSubmitButton('disabled', 'Unable to connect to network');
        this._clearOutput();
        this.isLoading = false;
        return;
      }

      this.currentRoute = route;

      if (!route || route.totalAmountOut === 0n) {
        this._updateSubmitButton('disabled', t('noRouteFound'));
        this._clearOutput();
        return;
      }

      // Update output amount
      const amountOutFloat = Number(route.totalAmountOut) / (10 ** this.tokenOut.decimals);
      this.amountOut = amountOutFloat.toFixed(this.tokenOut.decimals <= 6 ? 2 : 6);
      this.element.querySelector('#amount-input-out').value = this._formatAmountDisplay(amountOutFloat);

      // Update info section
      this._updateInfoSection(route, amountInNum, amountOutFloat);

      // Update route visualizer
      if (this.routeVisualizer) this.routeVisualizer.update(route);

      // Update submit button
      if (isReadOnly) {
        this._updateSubmitButton('ready', 'Connect Wallet to Swap');
      } else {
        this._updateSubmitButton('ready', 'Swap');
      }
    } catch (error) {
      console.error('Route calculation error:', error);
      this._updateSubmitButton('disabled', 'Error calculating route');
    }

    this.isLoading = false;
  }

  _updateInfoSection(route, amountInNum, amountOutNum) {
    const infoSection = this.element.querySelector('#swap-info');
    infoSection.style.display = 'flex';

    // Rate
    const rate = amountOutNum / amountInNum;
    this.element.querySelector('#swap-rate').textContent =
      `1 ${this.tokenIn.symbol} = ${this._formatAmountDisplay(rate)} ${this.tokenOut.symbol}`;

    // Fee
    const feeBps = feeManager.feeBps;
    const { feeHuman } = feeManager.calculateFeeHuman(amountInNum, this.tokenIn.decimals);
    if (Number(feeBps) > 0) {
      this.element.querySelector('#swap-fee').textContent =
        `${this._formatAmountDisplay(feeHuman)} ${this.tokenIn.symbol} (${feeManager.getFeePercentage()})`;
    } else {
      this.element.querySelector('#swap-fee').textContent = 'None';
    }

    // Price impact
    const impactEl = this.element.querySelector('#swap-impact');
    const impact = route.priceImpact;
    impactEl.textContent = `${impact.toFixed(2)}%`;
    impactEl.className = 'swap-info-value' + (impact < 1 ? ' positive' : impact > 5 ? ' danger' : '');

    // Min received (uses user's slippage tolerance from settings)
    const slippagePct = this.getSlippage ? this.getSlippage() : 0.5;
    const slippage = slippagePct / 100;
    const minReceived = amountOutNum * (1 - slippage);
    this.element.querySelector('#swap-min-received').textContent =
      `${this._formatAmountDisplay(minReceived)} ${this.tokenOut.symbol}`;

    // Gas — use live gas price
    const provider = this.getProvider ? this.getProvider() : null;
    estimateGasCostUsd(provider, route.totalGas).then(({ costUsd, gasPriceGwei }) => {
      const gasEl = this.element.querySelector('#swap-gas');
      gasEl.textContent = `~$${costUsd.toFixed(2)} (${gasPriceGwei.toFixed(1)} gwei)`;
    });
  }

  _formatAmountDisplay(num) {
    if (num === 0) return '0';
    if (num < 0.001) return num.toExponential(2);
    if (num < 1) return num.toFixed(6);
    if (num < 10) return num.toFixed(4);
    if (num < 10000) return num.toFixed(2);
    return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }

  _updateSubmitButton(state, text) {
    const btn = this.element.querySelector('#swap-submit-btn');
    btn.className = 'swap-submit-btn ' + state;
    btn.textContent = text;
  }

  _clearOutput() {
    this.amountOut = '';
    this.currentRoute = null;
    this.element.querySelector('#amount-input-out').value = '';
    this.element.querySelector('#swap-info').style.display = 'none';
    this._updateSubmitButton('disabled', t('enterAmount'));
    if (this.routeVisualizer) this.routeVisualizer.hide();
  }

  /**
   * Clear all input/output fields — used when switching chains
   */
  clearFields() {
    this.amountIn = '';
    this.amountOut = '';
    this.currentRoute = null;
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.element.querySelector('#amount-input-in').value = '';
    this.element.querySelector('#amount-input-out').value = '';
    this.element.querySelector('#swap-info').style.display = 'none';
    this.element.querySelector('#usd-value-in').textContent = '';
    this.element.querySelector('#usd-value-out').textContent = '';
    this._updateSubmitButton('disabled', t('enterAmount'));
    if (this.routeVisualizer) this.routeVisualizer.hide();
  }

  _showBalanceError() {
    // Brief red flash on the submit button
    this._updateSubmitButton('disabled', t('balanceNotEnough'));
    // Also show a floating notification
    const notification = document.createElement('div');
    notification.className = 'notification error';
    notification.textContent = t('balanceNotEnough');
    document.body.appendChild(notification);
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transform = 'translateX(100px)';
      notification.style.transition = 'all 0.3s ease';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
    // Reset button after a moment
    setTimeout(() => {
      if (this.currentRoute) {
        this._updateSubmitButton('ready', t('swapBtn'));
      }
    }, 2000);
  }

  /**
   * Update all translatable text to the current locale
   */
  updateLocale() {
    if (!this.element) return;
    // Static labels
    this.element.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      // Keep child nodes (like the tooltip ?)
      const firstText = el.childNodes[0];
      if (firstText && firstText.nodeType === Node.TEXT_NODE) {
        firstText.textContent = t(key);
      } else {
        el.textContent = t(key);
      }
    });
    // Balances
    this.updateBalances();
    // Submit button (if not in a loading/specific state)
    const btn = this.element.querySelector('#swap-submit-btn');
    if (btn.classList.contains('disabled') && !this.isLoading) {
      btn.textContent = t('enterAmount');
    } else if (btn.classList.contains('ready')) {
      btn.textContent = t('swapBtn');
    }
  }
}
