/**
 * OwlSwap Points — SQLite Database Module
 *
 * Stores per-address points (1 point per $0.01 swap volume)
 * and individual transaction records.
 */
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'points.db');
let db;

function getDb() {
    if (!db) {
        db = new Database(DB_PATH);
        db.pragma('journal_mode = WAL');
        db.pragma('synchronous = NORMAL');
        migrate();
    }
    return db;
}

function migrate() {
    const d = getDb();

    d.exec(`
        CREATE TABLE IF NOT EXISTS points (
            address     TEXT PRIMARY KEY,
            total_points    REAL DEFAULT 0,
            total_volume_usd REAL DEFAULT 0,
            tx_count    INTEGER DEFAULT 0,
            last_updated TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS transactions (
            tx_hash     TEXT PRIMARY KEY,
            block_number INTEGER,
            address     TEXT,
            volume_usd  REAL,
            points      REAL,
            chain_id    INTEGER DEFAULT 1,
            created_at  TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS scan_state (
            chain_id    INTEGER PRIMARY KEY,
            last_block  INTEGER DEFAULT 0
        );

        CREATE INDEX IF NOT EXISTS idx_points_total ON points(total_points DESC);
        CREATE INDEX IF NOT EXISTS idx_tx_address ON transactions(address);
    `);
}

/** Credit points to an address for a swap transaction */
function creditPoints(address, txHash, blockNumber, volumeUsd, chainId = 1) {
    const d = getDb();
    const points = volumeUsd / 0.01; // 1 point per $0.01

    // Insert transaction (ignore duplicates)
    const insertTx = d.prepare(`
        INSERT OR IGNORE INTO transactions (tx_hash, block_number, address, volume_usd, points, chain_id)
        VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = insertTx.run(txHash, blockNumber, address.toLowerCase(), volumeUsd, points, chainId);

    // Only update points if the tx was newly inserted (not a duplicate)
    if (result.changes > 0) {
        const upsert = d.prepare(`
            INSERT INTO points (address, total_points, total_volume_usd, tx_count, last_updated)
            VALUES (?, ?, ?, 1, datetime('now'))
            ON CONFLICT(address) DO UPDATE SET
                total_points = total_points + excluded.total_points,
                total_volume_usd = total_volume_usd + excluded.total_volume_usd,
                tx_count = tx_count + 1,
                last_updated = datetime('now')
        `);
        upsert.run(address.toLowerCase(), points, volumeUsd);
    }

    return { points, isNew: result.changes > 0 };
}

/** Get points for a specific address */
function getPoints(address) {
    const d = getDb();
    const row = d.prepare('SELECT * FROM points WHERE address = ?').get(address.toLowerCase());
    if (!row) return { address: address.toLowerCase(), total_points: 0, total_volume_usd: 0, tx_count: 0, rank: null };

    const rank = d.prepare('SELECT COUNT(*) + 1 as rank FROM points WHERE total_points > ?').get(row.total_points);
    return { ...row, rank: rank.rank };
}

/** Get top N addresses by points */
function getLeaderboard(limit = 100) {
    const d = getDb();
    return d.prepare('SELECT *, ROW_NUMBER() OVER (ORDER BY total_points DESC) as rank FROM points ORDER BY total_points DESC LIMIT ?').all(limit);
}

/** Get/set the last scanned block for a chain */
function getLastBlock(chainId = 1) {
    const d = getDb();
    const row = d.prepare('SELECT last_block FROM scan_state WHERE chain_id = ?').get(chainId);
    return row?.last_block || 0;
}

function setLastBlock(chainId, blockNumber) {
    const d = getDb();
    d.prepare('INSERT OR REPLACE INTO scan_state (chain_id, last_block) VALUES (?, ?)').run(chainId, blockNumber);
}

module.exports = { getDb, creditPoints, getPoints, getLeaderboard, getLastBlock, setLastBlock };
