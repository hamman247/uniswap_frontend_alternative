/**
 * Wallet Connection Module
 * Handles MetaMask / injected provider detection and connection
 */

export class WalletConnect {
    constructor() {
        this.provider = null;
        this.signer = null;
        this.address = null;
        this.chainId = null;
        this.listeners = [];
    }

    /**
     * Subscribe to wallet state changes
     */
    onChange(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    _notify() {
        const state = {
            address: this.address,
            chainId: this.chainId,
            provider: this.provider,
            signer: this.signer,
            connected: !!this.address,
        };
        this.listeners.forEach(cb => cb(state));
    }

    /**
     * Connect to the user's wallet
     */
    async connect() {
        if (typeof window.ethereum === 'undefined') {
            this._showNoWalletPrompt();
            return false;
        }

        try {
            const { ethers } = await import('ethers');

            // Request accounts
            await window.ethereum.request({ method: 'eth_requestAccounts' });

            this.provider = new ethers.BrowserProvider(window.ethereum);
            this.signer = await this.provider.getSigner();
            this.address = await this.signer.getAddress();

            const network = await this.provider.getNetwork();
            this.chainId = Number(network.chainId);

            // Listen for account/chain changes
            window.ethereum.on('accountsChanged', (accounts) => {
                if (accounts.length === 0) {
                    this.disconnect();
                } else {
                    this.address = accounts[0];
                    this.provider.getSigner().then(s => { this.signer = s; });
                    this._notify();
                }
            });

            window.ethereum.on('chainChanged', (chainIdHex) => {
                this.chainId = parseInt(chainIdHex, 16);
                // Reload provider on chain change
                this.provider = new ethers.BrowserProvider(window.ethereum);
                this.provider.getSigner().then(s => { this.signer = s; });
                this._notify();
            });

            this._notify();
            return true;
        } catch (error) {
            console.error('Wallet connection failed:', error);
            return false;
        }
    }

    /**
     * Disconnect wallet
     */
    disconnect() {
        this.provider = null;
        this.signer = null;
        this.address = null;
        this.chainId = null;
        this._notify();
    }

    /**
     * Get the chain name
     */
    getNetworkName() {
        const names = {
            1: 'Ethereum',
            5: 'Goerli',
            11155111: 'Sepolia',
            137: 'Polygon',
            42161: 'Arbitrum',
            10: 'Optimism',
            8453: 'Base',
        };
        return names[this.chainId] || `Chain ${this.chainId}`;
    }

    /**
     * Show prompt when no wallet is detected
     */
    _showNoWalletPrompt() {
        const notification = document.createElement('div');
        notification.className = 'notification error';
        notification.innerHTML = `
      <span>🦊</span>
      <span>No wallet detected. Please install <a href="https://metamask.io" target="_blank" style="color: var(--accent-purple);">MetaMask</a> or another Web3 wallet.</span>
    `;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 5000);
    }

    /**
     * Check if connected to Ethereum mainnet
     */
    isMainnet() {
        return this.chainId === 1;
    }
}

export const walletConnect = new WalletConnect();
