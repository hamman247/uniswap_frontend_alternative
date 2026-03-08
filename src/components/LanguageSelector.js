/**
 * Language Selector — bottom-corner dropdown for switching languages
 */
import { t, getLocale, setLocale, onLocaleChange, SUPPORTED_LOCALES, LOCALE_NAMES } from '../i18n/i18n.js';

export class LanguageSelector {
    constructor() {
        this.element = null;
        this.isOpen = false;
    }

    render() {
        const container = document.createElement('div');
        container.className = 'lang-selector';
        container.id = 'lang-selector';

        container.innerHTML = `
      <button class="lang-selector-btn" id="lang-btn">
        <span class="lang-icon">🌐</span>
        <span class="lang-label" id="lang-label">${LOCALE_NAMES[getLocale()]}</span>
      </button>
      <div class="lang-dropdown" id="lang-dropdown">
        ${SUPPORTED_LOCALES.map(code => `
          <button class="lang-option${code === getLocale() ? ' active' : ''}" data-locale="${code}">
            ${LOCALE_NAMES[code]}
          </button>
        `).join('')}
      </div>
    `;

        this.element = container;
        this._attachEvents();
        return container;
    }

    _attachEvents() {
        const btn = this.element.querySelector('#lang-btn');
        const dropdown = this.element.querySelector('#lang-dropdown');

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.isOpen = !this.isOpen;
            dropdown.classList.toggle('open', this.isOpen);
        });

        // Close on outside click
        document.addEventListener('click', () => {
            this.isOpen = false;
            dropdown.classList.remove('open');
        });

        // Language option clicks
        this.element.querySelectorAll('.lang-option').forEach(opt => {
            opt.addEventListener('click', (e) => {
                e.stopPropagation();
                const locale = opt.dataset.locale;
                setLocale(locale);
                // Update active state
                this.element.querySelectorAll('.lang-option').forEach(o => o.classList.remove('active'));
                opt.classList.add('active');
                this.element.querySelector('#lang-label').textContent = LOCALE_NAMES[locale];
                this.isOpen = false;
                dropdown.classList.remove('open');
            });
        });
    }
}
