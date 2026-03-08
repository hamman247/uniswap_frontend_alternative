/**
 * OwlSwap Points API Client
 *
 * All calls have a timeout and gracefully return null on failure,
 * so the main app works fine without the points backend.
 */

// Only attempt to reach the points API when running locally.
// On deployed sites, the API would need to be hosted separately —
// until then, all calls gracefully return null ("Points unavailable").
function getApiBase() {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
        return 'http://localhost:3001/api';
    }
    // For production: set your deployed API URL here, e.g.:
    // return 'https://your-points-api.example.com/api';
    return null; // No API available → all calls return null
}

const API_BASE = getApiBase();
const TIMEOUT_MS = 3000;

async function fetchWithTimeout(url, timeoutMs = TIMEOUT_MS) {
    if (!url) return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);
        if (!res.ok) return null;
        return await res.json();
    } catch {
        clearTimeout(timer);
        return null;
    }
}

/** Get points for a specific address. Returns null if API is unavailable. */
export async function getPointsForAddress(address) {
    if (!address) return null;
    return fetchWithTimeout(`${API_BASE}/points/${address}`);
}

/** Get the top 100 leaderboard. Returns null if API is unavailable. */
export async function getLeaderboard(limit = 100) {
    return fetchWithTimeout(`${API_BASE}/leaderboard?limit=${limit}`);
}

/** Look up a specific address on the leaderboard. Returns null if unavailable. */
export async function lookupAddress(address) {
    if (!address) return null;
    return fetchWithTimeout(`${API_BASE}/leaderboard/${address}`);
}

/** Check if the points API is reachable. */
export async function isPointsApiAvailable() {
    const data = await fetchWithTimeout(`${API_BASE}/health`, 2000);
    return data?.status === 'ok';
}
