/**
 * Route Visualizer — shows optimal route split across V2/V3/V4
 */
import { ICONS } from './icons.js';

export class RouteVisualizer {
    constructor() {
        this.element = null;
        this.isExpanded = true;
        this.routeResult = null;
    }

    render() {
        const container = document.createElement('div');
        container.className = 'route-visualizer animate-fade-in-up';
        container.id = 'route-visualizer';
        container.style.display = 'none';
        container.innerHTML = `
      <div class="route-header" id="route-header-toggle">
        <div class="route-header-left">
          <span class="route-title">Order Routing</span>
          <span class="route-label-best">Best Price</span>
        </div>
        <svg class="route-toggle-icon expanded" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </div>
      <div class="route-body expanded" id="route-body">
        <div class="route-bar-container" id="route-bar"></div>
        <div class="route-bar-legend" id="route-legend"></div>
        <div id="route-paths"></div>
      </div>
    `;

        this.element = container;
        this._bindEvents();
        return container;
    }

    _bindEvents() {
        this.element.querySelector('#route-header-toggle').addEventListener('click', () => {
            this.isExpanded = !this.isExpanded;
            const body = this.element.querySelector('#route-body');
            const icon = this.element.querySelector('.route-toggle-icon');
            body.classList.toggle('expanded', this.isExpanded);
            icon.classList.toggle('expanded', this.isExpanded);
        });
    }

    update(routeResult) {
        if (!routeResult || !routeResult.routes || routeResult.routes.length === 0) {
            this.element.style.display = 'none';
            this.routeResult = null;
            return;
        }

        this.routeResult = routeResult;
        this.element.style.display = 'block';

        // Aggregate percentages by version
        const versionSplits = {};
        for (const route of routeResult.routes) {
            const v = route.pool.version;
            versionSplits[v] = (versionSplits[v] || 0) + route.percentage;
        }

        // Render bar
        const bar = this.element.querySelector('#route-bar');
        bar.innerHTML = Object.entries(versionSplits)
            .sort((a, b) => b[1] - a[1])
            .map(([version, pct]) =>
                `<div class="route-bar-segment ${version.toLowerCase()}" style="width: ${pct}%"></div>`
            ).join('');

        // Render legend
        const legend = this.element.querySelector('#route-legend');
        legend.innerHTML = Object.entries(versionSplits)
            .sort((a, b) => b[1] - a[1])
            .map(([version, pct]) => `
        <div class="route-bar-legend-item">
          <div class="route-bar-legend-dot" style="background: var(--${version.toLowerCase()}-color)"></div>
          ${version} · ${pct}%
        </div>
      `).join('');

        // Render individual paths
        const paths = this.element.querySelector('#route-paths');
        paths.innerHTML = routeResult.routes.map(route => `
      <div class="route-path">
        <span class="route-version-badge ${route.pool.version.toLowerCase()}">${route.pool.version}</span>
        <div class="route-flow">
          <span class="route-flow-token">Input</span>
          <svg class="route-flow-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
          <span class="route-flow-fee">${route.pool.feeLabel}</span>
          <svg class="route-flow-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
          <span class="route-flow-token">Output</span>
        </div>
        <span class="route-split">${route.percentage}%</span>
      </div>
    `).join('');
    }

    showLoading() {
        this.element.style.display = 'block';
        const paths = this.element.querySelector('#route-paths');
        paths.innerHTML = `
      <div class="route-loading">
        <div class="route-loading-spinner"></div>
        Finding best route across V2, V3, & V4 pools...
      </div>
    `;
        this.element.querySelector('#route-bar').innerHTML = '';
        this.element.querySelector('#route-legend').innerHTML = '';
    }

    hide() {
        this.element.style.display = 'none';
    }
}
