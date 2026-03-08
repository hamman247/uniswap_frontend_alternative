/**
 * OwlSwap Points — Block Scanner
 *
 * Scans Ethereum blocks for Universal Router transactions
 * that end with the OWLSWAP tracking tag (0x4f574c53574150).
 * Estimates USD volume from Transfer events and credits points.
 */
const { ethers } = require('ethers');
const { creditPoints, getLastBlock, setLastBlock } = require('./db');

// ─── Configuration ───
const TRACKING_TAG = '4f574c53574150'; // "OWLSWAP" in hex
const UNIVERSAL_ROUTER = '0x66a9893cC07D91D95644AEDD05D03f95e1dBA8Af'.toLowerCase();

// Known stablecoins (mainnet) — value = token amount / 10^decimals
const STABLECOINS = {
    '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': { symbol: 'USDC', decimals: 6 },
    '0xdac17f958d2ee523a2206206994597c13d831ec7': { symbol: 'USDT', decimals: 6 },
    '0x6b175474e89094c44da98b954eedeac495271d0f': { symbol: 'DAI', decimals: 18 },
};

// ERC-20 Transfer event signature
const TRANSFER_SIG = ethers.id('Transfer(address,address,uint256)');

// ETH price cache
let cachedEthPrice = 2500; // fallback
let ethPriceLastFetch = 0;

async function fetchEthPrice() {
    if (Date.now() - ethPriceLastFetch < 5 * 60 * 1000) return cachedEthPrice;
    try {
        const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
        const data = await res.json();
        if (data?.ethereum?.usd) {
            cachedEthPrice = data.ethereum.usd;
            ethPriceLastFetch = Date.now();
        }
    } catch (e) {
        console.warn('Failed to fetch ETH price, using cached:', cachedEthPrice);
    }
    return cachedEthPrice;
}

/**
 * Estimate USD volume of a swap transaction from its receipt.
 * Looks at Transfer events involving stablecoins or uses ETH value.
 */
function estimateVolumeUsd(receipt, tx, ethPrice) {
    let maxStablecoinVolume = 0;

    // Scan Transfer events for stablecoin amounts
    for (const log of receipt.logs) {
        if (log.topics[0] !== TRANSFER_SIG) continue;
        const tokenAddr = log.address.toLowerCase();
        const stable = STABLECOINS[tokenAddr];
        if (!stable) continue;

        try {
            const amount = BigInt(log.data);
            const usdValue = Number(amount) / Math.pow(10, stable.decimals);
            if (usdValue > maxStablecoinVolume) {
                maxStablecoinVolume = usdValue;
            }
        } catch { /* skip malformed logs */ }
    }

    if (maxStablecoinVolume > 0) return maxStablecoinVolume;

    // Fallback: use ETH value of the transaction
    if (tx.value && BigInt(tx.value) > 0n) {
        const ethValue = Number(BigInt(tx.value)) / 1e18;
        return ethValue * ethPrice;
    }

    return 0;
}

/**
 * Scan a range of blocks for tagged OwlSwap transactions.
 */
async function scanBlocks(provider, fromBlock, toBlock, chainId = 1) {
    const ethPrice = await fetchEthPrice();
    let processedCount = 0;
    let pointsCredited = 0;

    for (let blockNum = fromBlock; blockNum <= toBlock; blockNum++) {
        try {
            const block = await provider.getBlock(blockNum, true); // prefetch txs
            if (!block || !block.prefetchedTransactions) continue;

            for (const tx of block.prefetchedTransactions) {
                // Check if tx is to the Universal Router
                if (!tx.to || tx.to.toLowerCase() !== UNIVERSAL_ROUTER) continue;

                // Check if calldata ends with our tracking tag
                const inputHex = tx.data.toLowerCase();
                if (!inputHex.endsWith(TRACKING_TAG.toLowerCase())) continue;

                // Found a tagged transaction!
                try {
                    const receipt = await provider.getTransactionReceipt(tx.hash);
                    if (!receipt || receipt.status !== 1) continue; // skip failed txs

                    const volumeUsd = estimateVolumeUsd(receipt, tx, ethPrice);
                    if (volumeUsd < 0.01) continue; // skip dust

                    const result = creditPoints(tx.from, tx.hash, blockNum, volumeUsd, chainId);
                    if (result.isNew) {
                        pointsCredited += result.points;
                        processedCount++;
                        console.log(`  ✓ ${tx.hash.slice(0, 10)}... | ${tx.from.slice(0, 10)}... | $${volumeUsd.toFixed(2)} | +${result.points.toFixed(0)} pts`);
                    }
                } catch (e) {
                    console.warn(`  ✗ Error processing ${tx.hash.slice(0, 10)}...`, e.message);
                }
            }
        } catch (e) {
            // Some blocks might fail — skip and continue
            if (!e.message?.includes('block not found')) {
                console.warn(`  Block ${blockNum} error:`, e.message);
            }
        }
    }

    return { processedCount, pointsCredited };
}

/**
 * Main scan loop — picks up where we left off and scans forward.
 */
async function runScanner(provider, chainId = 1) {
    const BATCH_SIZE = 10; // blocks per iteration (conservative for public RPCs)

    try {
        const headBlock = await provider.getBlockNumber();
        let lastScanned = getLastBlock(chainId);

        // If first run, start from a recent block (don't scan entire history)
        if (lastScanned === 0) {
            lastScanned = headBlock - 100; // start ~100 blocks back
            console.log(`First scan: starting from block ${lastScanned}`);
        }

        const fromBlock = lastScanned + 1;
        const toBlock = Math.min(fromBlock + BATCH_SIZE - 1, headBlock);

        if (fromBlock > headBlock) {
            return { scanned: 0, headBlock };
        }

        console.log(`Scanning blocks ${fromBlock}–${toBlock} (head: ${headBlock}, ${headBlock - toBlock} behind)`);
        const result = await scanBlocks(provider, fromBlock, toBlock, chainId);
        setLastBlock(chainId, toBlock);

        return { ...result, scanned: toBlock - fromBlock + 1, headBlock, lastScanned: toBlock };
    } catch (e) {
        console.error('Scanner error:', e.message);
        return { scanned: 0, error: e.message };
    }
}

module.exports = { runScanner, scanBlocks, TRACKING_TAG };
