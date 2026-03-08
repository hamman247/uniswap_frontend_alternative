/**
 * Settings Panel — slippage tolerance, deadline, expert mode
 */
import { ICONS } from './icons.js';
import { t } from '../i18n/i18n.js';

const DEFAULT_SLIPPAGE = 0.5;
const DEFAULT_DEADLINE = 20;

export class Settings {
  constructor({ onUpdate }) {
    this.onUpdate = onUpdate;
    this.slippage = DEFAULT_SLIPPAGE;
    this.deadline = DEFAULT_DEADLINE;
    this.expertMode = false;
    this.showTestnets = localStorage.getItem('wiseswap_testnets') === 'true';
    this.element = null;
  }

  render() {
    const panel = document.createElement('div');
    panel.className = 'settings-panel';
    panel.id = 'settings-panel';
    panel.innerHTML = `
      <div class="settings-header">
        <span class="settings-title" data-i18n="settings">${t('settings')}</span>
        <button class="settings-close-btn" id="settings-close">${ICONS.close}</button>
      </div>

      <div class="settings-section">
        <div class="settings-section-title" data-i18n="slippageTolerance">${t('slippageTolerance')}</div>
        <div class="slippage-buttons">
          <button class="slippage-btn" data-value="0.1">0.1%</button>
          <button class="slippage-btn active" data-value="0.5">0.5%</button>
          <button class="slippage-btn" data-value="1.0">1.0%</button>
        </div>
        <div class="slippage-custom">
          <input type="number" class="slippage-custom-input" id="slippage-custom"
                 placeholder="${t('customPercent')}" step="0.1" min="0.01" max="50" />
          <span style="font-size: 0.8rem; color: var(--text-tertiary);">%</span>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title" data-i18n="txDeadline">${t('txDeadline')}</div>
        <div class="deadline-input-container">
          <input type="number" class="deadline-input" id="deadline-input"
                 value="${this.deadline}" min="1" max="180" />
          <span class="deadline-label" data-i18n="minutes">${t('minutes')}</span>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title" data-i18n="developer">${t('developer')}</div>
        <div class="settings-toggle-row">
          <label class="settings-toggle-label" for="testnet-toggle" data-i18n="showTestnets">${t('showTestnets')}</label>
          <label class="toggle-switch">
            <input type="checkbox" id="testnet-toggle" ${this.showTestnets ? 'checked' : ''} />
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>
    `;

    this.element = panel;
    this._bindEvents();
    return panel;
  }

  _bindEvents() {
    // Close
    this.element.querySelector('#settings-close').addEventListener('click', () => this.close());

    // Slippage preset buttons
    this.element.querySelectorAll('.slippage-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.element.querySelectorAll('.slippage-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.slippage = parseFloat(btn.dataset.value);
        this.element.querySelector('#slippage-custom').value = '';
        this._emitUpdate();
      });
    });

    // Slippage custom
    this.element.querySelector('#slippage-custom').addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (!isNaN(val) && val > 0 && val <= 50) {
        this.slippage = val;
        this.element.querySelectorAll('.slippage-btn').forEach(b => b.classList.remove('active'));
        this._emitUpdate();
      }
    });

    // Deadline
    this.element.querySelector('#deadline-input').addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      if (!isNaN(val) && val >= 1) {
        this.deadline = val;
        this._emitUpdate();
      }
    });

    // Testnet toggle
    this.element.querySelector('#testnet-toggle').addEventListener('change', (e) => {
      this.showTestnets = e.target.checked;
      localStorage.setItem('wiseswap_testnets', String(this.showTestnets));
      this._emitUpdate();
    });
  }

  _emitUpdate() {
    if (this.onUpdate) {
      this.onUpdate({
        slippage: this.slippage,
        deadline: this.deadline,
        expertMode: this.expertMode,
        showTestnets: this.showTestnets,
      });
    }
  }

  open() {
    this.element.classList.add('open');
  }

  close() {
    this.element.classList.remove('open');
  }

  toggle() {
    this.element.classList.toggle('open');
  }

  getSlippageBps() {
    return Math.round(this.slippage * 100); // 0.5% → 50 bps
  }

  updateLocale() {
    if (!this.element) return;
    this.element.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    const customInput = this.element.querySelector('#slippage-custom');
    if (customInput) customInput.placeholder = t('customPercent');
  }
}
