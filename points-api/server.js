/**
 * OwlSwap Points API — Express Server
 *
 * REST API for querying user points and leaderboard.
 * Runs a background scanner that indexes OWLSWAP-tagged transactions.
 *
 * Usage:
 *   node server.js                         # default: Ethereum mainnet
 *   RPC_URL=https://... node server.js     # custom RPC
 *   PORT=3001 node server.js               # custom port
 */
const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
const { getPoints, getLeaderboard } = require('./db');
const { runScanner } = require('./scanner');

const app = express();
const PORT = process.env.PORT || 3001;
const RPC_URL = process.env.RPC_URL || 'https://ethereum-rpc.publicnode.com';
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '1');
const SCAN_INTERVAL_MS = parseInt(process.env.SCAN_INTERVAL || '15000'); // 15s

// ─── Middleware ───
app.use(cors());
app.use(express.json());

// ─── Health check ───
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', chainId: CHAIN_ID, uptime: process.uptime() });
});

// ─── Get points for an address ───
app.get('/api/points/:address', (req, res) => {
    try {
        const { address } = req.params;
        if (!ethers.isAddress(address)) {
            return res.status(400).json({ error: 'Invalid address' });
        }
        const data = getPoints(address);
        res.json({
            address: data.address,
            points: Math.floor(data.total_points),
            volumeUsd: Math.round(data.total_volume_usd * 100) / 100,
            txCount: data.tx_count,
            rank: data.rank,
        });
    } catch (e) {
        console.error('Error fetching points:', e.message);
        res.status(500).json({ error: 'Internal error' });
    }
});

// ─── Leaderboard: top 100 ───
app.get('/api/leaderboard', (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit || '100'), 500);
        const rows = getLeaderboard(limit);
        res.json({
            top: rows.map(r => ({
                rank: r.rank,
                address: r.address,
                points: Math.floor(r.total_points),
                volumeUsd: Math.round(r.total_volume_usd * 100) / 100,
                txCount: r.tx_count,
            })),
            totalUsers: rows.length,
        });
    } catch (e) {
        console.error('Error fetching leaderboard:', e.message);
        res.status(500).json({ error: 'Internal error' });
    }
});

// ─── Lookup specific address rank ───
app.get('/api/leaderboard/:address', (req, res) => {
    try {
        const { address } = req.params;
        if (!ethers.isAddress(address)) {
            return res.status(400).json({ error: 'Invalid address' });
        }
        const data = getPoints(address);
        res.json({
            address: data.address,
            points: Math.floor(data.total_points),
            volumeUsd: Math.round(data.total_volume_usd * 100) / 100,
            txCount: data.tx_count,
            rank: data.rank,
        });
    } catch (e) {
        console.error('Error looking up address:', e.message);
        res.status(500).json({ error: 'Internal error' });
    }
});

// ─── Start server ───
app.listen(PORT, () => {
    console.log(`\n🦉 OwlSwap Points API running on http://localhost:${PORT}`);
    console.log(`   Chain: ${CHAIN_ID} | RPC: ${RPC_URL}`);
    console.log(`   Scanner interval: ${SCAN_INTERVAL_MS / 1000}s\n`);

    // Start background scanner
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    let scanning = false;

    const scan = async () => {
        if (scanning) return;
        scanning = true;
        try {
            const result = await runScanner(provider, CHAIN_ID);
            if (result.processedCount > 0) {
                console.log(`  → Processed ${result.processedCount} txs, +${result.pointsCredited?.toFixed(0) || 0} points`);
            }
        } catch (e) {
            console.error('Scanner cycle error:', e.message);
        }
        scanning = false;
    };

    // Initial scan after a short delay
    setTimeout(scan, 2000);
    // Periodic scanning
    setInterval(scan, SCAN_INTERVAL_MS);
});
