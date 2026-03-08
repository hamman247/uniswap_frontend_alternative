/**
 * PointsDisplay — Shows connected wallet's points in the header
 *
 * Displays "Points unavailable" if the API is down.
 * Auto-refreshes after swaps.
 */
import { getPointsForAddress } from '../services/pointsApi.js';

export class PointsDisplay {
    constructor() {
        this.el = null;
        this.address = null;
        this.points = null;
        this.loading = false;
    }

    render() {
        this.el = document.createElement('div');
        this.el.className = 'points-display';
        this.el.innerHTML = this._html();
        return this.el;
    }

    _html() {
        if (!this.address) return ''; // Hidden when no wallet

        if (this.loading) {
            return `<div class="points-badge">
                <span class="points-icon">⭐</span>
                <span class="points-value loading">...</span>
            </div>`;
        }

        if (this.points === null) {
            return `<div class="points-badge unavailable" title="Points API offline">
                <span class="points-icon">⭐</span>
                <span class="points-value">unavailable</span>
            </div>`;
        }

        const formatted = this.points.toLocaleString();
        return `<div class="points-badge" title="${this.points} points earned from swap volume">
            <span class="points-icon">⭐</span>
            <span class="points-value">${formatted}</span>
            <span class="points-label">pts</span>
        </div>`;
    }

    async setAddress(address) {
        this.address = address;
        if (!address) {
            this.points = null;
            this._update();
            return;
        }
        await this.refresh();
    }

    async refresh() {
        if (!this.address) return;
        this.loading = true;
        this._update();

        const data = await getPointsForAddress(this.address);
        this.loading = false;
        this.points = data?.points ?? null;
        this._update();
    }

    _update() {
        if (this.el) this.el.innerHTML = this._html();
    }
}
