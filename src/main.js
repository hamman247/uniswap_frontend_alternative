/**
 * OwlSwap — Main Application Entry Point
 *
 * Initializes all components and wires them together.
 * Supports routing through Uniswap V2, V3, and V4 pools
 * across 12 mainnets + testnets.
 * Charges a 5 basis point (0.05%) interface fee on every swap.
 */
import { Header } from './components/Header.js';
import { SwapCard } from './components/SwapCard.js';
import { TokenModal } from './components/TokenModal.js';
import { Settings } from './components/Settings.js';
import { RouteVisualizer } from './components/RouteVisualizer.js';
import { PointsDisplay } from './components/PointsDisplay.js';
import { Leaderboard } from './components/Leaderboard.js';
import { walletConnect } from './components/WalletConnect.js';
import { executeRoute } from './routing/executor.js';
import { fetchAllBalances, clearBalanceCache } from './utils/balances.js';
import { clearGasPriceCache } from './utils/gasOracle.js';
import { setCurrentChainId } from './config/contracts.js';
import { getTokensForChain, getDefaultPair } from './config/tokens.js';
import { getChain } from './config/chains.js';

class App {
    constructor() {
        this.header = null;
        this.swapCard = null;
        this.tokenModal = null;
        this.settings = null;
        this.routeVisualizer = null;
        this.pointsDisplay = null;
        this.leaderboard = null;
        this.currentPage = 'swap'; // 'swap' or 'leaderboard'
        this.mainContainer = null;
        this.swapContent = null;
        this.tokenSelectSide = null; // 'in' or 'out'
        this.settingsValues = { slippage: 0.5, deadline: 20 };
        this.currentChainId = 1;
    }

    init() {
        const app = document.getElementById('app');
        const modalRoot = document.getElementById('modal-root');

        // ─── Header ───
        this.header = new Header({
            onConnectWallet: () => this._connectWallet(),
            onChainSelect: (chainId) => this._switchChain(chainId),
            onNavSwap: () => this._showPage('swap'),
            onNavLeaderboard: () => this._showPage('leaderboard'),
        });
        app.appendChild(this.header.render());

        // ─── Points Display (in header) ───
        this.pointsDisplay = new PointsDisplay();
        const pointsContainer = this.header.element.querySelector('#points-container');
        if (pointsContainer) pointsContainer.appendChild(this.pointsDisplay.render());

        // ─── Main Container ───
        const main = document.createElement('main');
        main.className = 'main-container';
        app.appendChild(main);
        this.mainContainer = main;

        // ─── Swap Page Content ───
        this.swapContent = document.createElement('div');
        this.swapContent.className = 'swap-page-content';

        // ─── Route Visualizer ───
        this.routeVisualizer = new RouteVisualizer();

        // ─── Swap Card ───
        this.swapCard = new SwapCard({
            onSwap: (route, tokenIn, tokenOut) => this._executeSwap(route, tokenIn, tokenOut),
            onSelectToken: (side, disabledAddr) => this._openTokenModal(side, disabledAddr),
            onOpenSettings: () => this.settings.toggle(),
            routeVisualizer: this.routeVisualizer,
            getProvider: () => walletConnect.provider || null,
            getSlippage: () => this.settingsValues.slippage,
        });

        // ─── Settings ───
        this.settings = new Settings({
            onUpdate: (values) => {
                this.settingsValues = values;
                if (this.header) {
                    this.header.updateTestnetVisibility(values.showTestnets);
                }
            },
        });

        // ─── Ad Banner: Top ───
        const adTop = document.createElement('div');
        adTop.className = 'ad-banner ad-banner-top';
        adTop.id = 'ad-slot-top';
        adTop.innerHTML = `<div class="ad-placeholder">Advertisement</div>`;
        this.swapContent.appendChild(adTop);

        // Wrap swap card with relative positioning for settings overlay
        const swapWrapper = document.createElement('div');
        swapWrapper.style.cssText = 'position: relative; width: 100%; max-width: 480px;';
        swapWrapper.appendChild(this.settings.render());
        swapWrapper.appendChild(this.swapCard.render());
        this.swapContent.appendChild(swapWrapper);

        // Route visualizer below swap card
        this.swapContent.appendChild(this.routeVisualizer.render());

        // ─── Ad Banner: Mid ───
        const adMid = document.createElement('div');
        adMid.className = 'ad-banner ad-banner-mid';
        adMid.id = 'ad-slot-mid';
        adMid.innerHTML = `<div class="ad-placeholder">Advertisement</div>`;
        this.swapContent.appendChild(adMid);

        // ─── Footer Attribution ───
        const footer = document.createElement('div');
        footer.style.cssText = 'text-align: center; padding: 24px; font-size: 0.75rem; color: var(--text-tertiary);';
        footer.innerHTML = `
      <p style="margin-bottom: 4px;">Routing optimized across Uniswap V2 · V3 · V4</p>
      <p style="margin-bottom: 4px;">No interface fees</p>
      <p style="margin-top: 12px; opacity: 0.7; font-style: italic;">Buy and sell cryptocurrencies at your own risk. Always Do Your Own Research.</p>
    `;
        this.swapContent.appendChild(footer);

        // Show swap page by default
        main.appendChild(this.swapContent);


        // ─── Token Modal ───
        this.tokenModal = new TokenModal({
            onSelect: (token) => {
                if (this.tokenSelectSide) {
                    this.swapCard.setToken(this.tokenSelectSide, token);
                }
            },
        });
        modalRoot.appendChild(this.tokenModal.render());

        // ─── Wallet state listener ───
        walletConnect.onChange(async (state) => {
            this.header.updateWallet(state.address);
            this.pointsDisplay.setAddress(state.address);
            if (state.connected) {
                // Detect the wallet's chain
                const chainId = await this._detectWalletChain();
                if (chainId && chainId !== this.currentChainId) {
                    this._onChainChanged(chainId);
                }
                await this._refreshBalances();
            } else {
                clearBalanceCache();
                this.swapCard.updateBalances();
            }
        });

        // Listen for wallet chain changes (e.g. user switches in MetaMask)
        if (window.ethereum) {
            window.ethereum.on('chainChanged', (hexChainId) => {
                const chainId = parseInt(hexChainId, 16);
                this._onChainChanged(chainId);
            });
        }

        console.log('🦉 OwlSwap initialized — V2/V3/V4 routing, zero fees');
    }

    /**
     * User selected a chain from the header dropdown
     */
    async _switchChain(chainId) {
        // If wallet connected, request chain switch
        if (walletConnect.provider && window.ethereum) {
            try {
                const chain = getChain(chainId);
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: '0x' + chainId.toString(16) }],
                });
                // chainChanged event will fire and call _onChainChanged
            } catch (err) {
                if (err.code === 4902) {
                    // Chain not added, try to add it
                    const chain = getChain(chainId);
                    if (chain) {
                        try {
                            await window.ethereum.request({
                                method: 'wallet_addEthereumChain',
                                params: [{
                                    chainId: '0x' + chainId.toString(16),
                                    chainName: chain.name,
                                    nativeCurrency: chain.nativeCurrency,
                                    rpcUrls: [chain.rpcUrl],
                                    blockExplorerUrls: [chain.blockExplorer],
                                }],
                            });
                        } catch (addErr) {
                            console.warn('Failed to add chain:', addErr);
                            this._showNotification('error', `Could not add ${chain.name}`);
                        }
                    }
                } else {
                    console.warn('Failed to switch chain:', err);
                }
            }
        } else {
            // No wallet connected — just update the UI state
            this._onChainChanged(chainId);
        }
    }

    /**
     * Called when the active chain actually changes (from wallet event or UI selection)
     */
    _onChainChanged(chainId) {
        const chain = getChain(chainId);
        if (!chain) {
            console.warn(`Unknown chain ID: ${chainId}`);
            return;
        }

        this.currentChainId = chainId;
        setCurrentChainId(chainId);

        // Update header
        this.header.setChain(chainId);

        // Clear caches
        clearBalanceCache();
        clearGasPriceCache();

        // Update swap card with new chain's default tokens
        const { tokenIn, tokenOut } = getDefaultPair(chainId);
        this.swapCard.setToken('in', tokenIn);
        this.swapCard.setToken('out', tokenOut);

        // Update token modal's list for new chain
        if (this.tokenModal) {
            this.tokenModal.setChainTokens(getTokensForChain(chainId));
        }

        // Refresh balances on new chain
        this._refreshBalances();

        this._showNotification('success', `Switched to ${chain.name}`);
    }

    async _detectWalletChain() {
        try {
            if (walletConnect.provider) {
                const network = await walletConnect.provider.getNetwork();
                return Number(network.chainId);
            }
        } catch {
            // ignore
        }
        return null;
    }

    async _connectWallet() {
        const connected = await walletConnect.connect();
        if (connected) {
            this._showNotification('success', `Connected: ${walletConnect.address.slice(0, 6)}...${walletConnect.address.slice(-4)}`);
        }
    }

    async _refreshBalances() {
        if (!walletConnect.provider || !walletConnect.address) return;
        try {
            const tokens = getTokensForChain(this.currentChainId);
            await fetchAllBalances(walletConnect.provider, walletConnect.address, tokens);
            this.swapCard.updateBalances();
        } catch (e) {
            console.warn('Balance fetch failed:', e.message);
        }
    }

    _openTokenModal(side, disabledAddress) {
        this.tokenSelectSide = side;
        this.tokenModal.open(disabledAddress);
    }

    async _executeSwap(route, tokenIn, tokenOut) {
        if (!walletConnect.signer) {
            const connected = await walletConnect.connect();
            if (!connected) {
                this._showNotification('error', 'Please connect your wallet to swap');
                return;
            }
        }

        try {
            this._showNotification('success', '🔄 Submitting swap transaction...');

            const slippageBps = this.settings.getSlippageBps();
            const deadline = this.settingsValues.deadline;

            const txResults = await executeRoute(
                walletConnect.signer,
                route,
                tokenIn,
                tokenOut,
                slippageBps,
                deadline
            );

            this._showNotification('success', `✅ Swap submitted! ${txResults.length} transaction(s)`);
            // Refresh points after successful swap
            setTimeout(() => this.pointsDisplay.refresh(), 5000);
        } catch (error) {
            console.error('Swap execution error:', error);
            const msg = error.reason || error.message || 'Transaction failed';
            this._showNotification('error', `❌ ${msg}`);
        }
    }

    _showPage(page) {
        this.currentPage = page;
        const main = this.mainContainer;
        if (!main) return;

        if (page === 'leaderboard') {
            // Hide swap content, show leaderboard
            if (this.swapContent.parentNode === main) main.removeChild(this.swapContent);
            if (this.leaderboard) this.leaderboard.destroy();
            this.leaderboard = new Leaderboard({
                onBack: () => {
                    this._showPage('swap');
                    this.header._setActiveNav('nav-swap');
                },
            });
            main.appendChild(this.leaderboard.render());
        } else {
            // Show swap content, remove leaderboard
            if (this.leaderboard) {
                this.leaderboard.destroy();
                this.leaderboard = null;
            }
            if (this.swapContent.parentNode !== main) main.appendChild(this.swapContent);
        }
    }

    _showNotification(type, message) {
        document.querySelectorAll('.notification').forEach(n => n.remove());

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100px)';
            notification.style.transition = 'all 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 4000);
    }
}

// ─── Initialize ───
const app = new App();
let initialized = false;
function initOnce() {
    if (initialized) return;
    initialized = true;
    app.init();
}
document.addEventListener('DOMContentLoaded', initOnce);
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initOnce();
}
