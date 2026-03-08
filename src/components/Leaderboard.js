/**
 * Leaderboard — Top 100 addresses by WiseSwap points
 *
 * Shows a styled table of top earners + address lookup input.
 * Displays "Points unavailable" when the API is down.
 */
import { getLeaderboard, lookupAddress } from '../services/pointsApi.js';

export class Leaderboard {
    constructor({ onBack }) {
        this.onBack = onBack;
        this.el = null;
        this.data = null;
        this.lookupResult = null;
        this.loading = true;
        this.error = false;
    }

    render() {
        this.el = document.createElement('div');
        this.el.className = 'leaderboard-page';
        this._load();
        this._update();
        return this.el;
    }

    async _load() {
        this.loading = true;
        this.error = false;
        this._update();

        const data = await getLeaderboard(100);
        this.loading = false;
        if (!data) {
            this.error = true;
        } else {
            this.data = data;
        }
        this._update();
    }

    async _lookupAddress(address) {
        if (!address || address.length < 42) {
            this.lookupResult = null;
            this._updateLookup();
            return;
        }
        const result = await lookupAddress(address.trim());
        this.lookupResult = result;
        this._updateLookup();
    }

    _update() {
        if (!this.el) return;
        this.el.innerHTML = `
            <div class="leaderboard-container">
                <div class="leaderboard-header">
                    <button class="leaderboard-back" id="lb-back">← Back</button>
                    <h2 class="leaderboard-title">🏆 Points Leaderboard</h2>
                    <p class="leaderboard-subtitle">Earn points for trading</p>
                </div>

                <div class="leaderboard-lookup">
                    <input type="text" id="lb-address-input"
                        placeholder="Look up address (0x...)" 
                        class="leaderboard-input"
                        spellcheck="false"
                        autocomplete="off" />
                    <div id="lb-lookup-result" class="lookup-result"></div>
                </div>

                <div class="leaderboard-table-wrap">
                    ${this._renderTable()}
                </div>
            </div>
        `;

        // Wire events
        this.el.querySelector('#lb-back')?.addEventListener('click', () => this.onBack?.());
        const input = this.el.querySelector('#lb-address-input');
        if (input) {
            let debounce;
            input.addEventListener('input', (e) => {
                clearTimeout(debounce);
                debounce = setTimeout(() => this._lookupAddress(e.target.value), 400);
            });
        }
    }

    _renderTable() {
        if (this.loading) {
            return '<div class="leaderboard-loading">Loading leaderboard...</div>';
        }
        if (this.error) {
            return '<div class="leaderboard-unavailable">⭐ Points unavailable</div>';
        }
        if (!this.data?.top?.length) {
            return '<div class="leaderboard-empty">No points earned yet. Be the first to swap!</div>';
        }

        const rows = this.data.top.map(r => `
            <tr>
                <td class="lb-rank">${r.rank}</td>
                <td class="lb-address" title="${r.address}">${this._truncAddr(r.address)}</td>
                <td class="lb-points">${r.points.toLocaleString()}</td>
                <td class="lb-volume">$${r.volumeUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td class="lb-txs">${r.txCount}</td>
            </tr>
        `).join('');

        return `
            <table class="leaderboard-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Address</th>
                        <th>Points</th>
                        <th>Volume</th>
                        <th>Swaps</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;
    }

    _updateLookup() {
        const container = this.el?.querySelector('#lb-lookup-result');
        if (!container) return;

        if (!this.lookupResult) {
            container.innerHTML = '';
            return;
        }

        const r = this.lookupResult;
        if (r.points === 0 && !r.rank) {
            container.innerHTML = `<div class="lookup-card">
                <span class="lookup-address">${this._truncAddr(r.address)}</span>
                <span class="lookup-no-points">No points yet</span>
            </div>`;
        } else {
            container.innerHTML = `<div class="lookup-card">
                <span class="lookup-rank">#${r.rank || '—'}</span>
                <span class="lookup-address">${this._truncAddr(r.address)}</span>
                <span class="lookup-points">${(r.points || 0).toLocaleString()} pts</span>
                <span class="lookup-volume">$${(r.volumeUsd || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>`;
        }
    }

    _truncAddr(addr) {
        if (!addr) return '';
        return addr.slice(0, 6) + '...' + addr.slice(-4);
    }

    destroy() {
        if (this.el?.parentNode) {
            this.el.parentNode.removeChild(this.el);
        }
    }
}
