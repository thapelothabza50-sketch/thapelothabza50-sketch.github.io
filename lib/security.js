'use strict';
const crypto = require('crypto');
const logger = require('./logger');

// ---------- request id + access log + hard response timeout ----------
function requestContext({ timeoutMs = 30000 } = {}) {
    return (req, res, next) => {
        req.id = crypto.randomBytes(6).toString('hex');
        res.setHeader('X-Request-Id', req.id);
        const start = process.hrtime.bigint();
        const timer = setTimeout(() => {
            if (!res.headersSent) {
                logger.warn('request timed out', { reqId: req.id, method: req.method, path: req.path });
                res.status(503).json({ success: false, message: 'The server took too long to respond. Please try again.' });
            }
        }, timeoutMs);
        timer.unref();
        res.on('close', () => clearTimeout(timer));
        res.on('finish', () => {
            const ms = Number(process.hrtime.bigint() - start) / 1e6;
            if (req.path === '/health' || req.path === '/ready' || process.env.ACCESS_LOG === 'off') return;
            if (!req.path.startsWith('/api/') && res.statusCode < 400) return; // keep logs small: API + failures only
            logger.info('request', { reqId: req.id, method: req.method, path: req.path, status: res.statusCode, ms: Math.round(ms), uid: req.user && req.user.id });
        });
        next();
    };
}

// ---------- security headers (no CSP script restrictions: pages rely on inline scripts + CDNs) ----------
function securityHeaders() {
    const prod = process.env.NODE_ENV === 'production';
    return (req, res, next) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'SAMEORIGIN');
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
        res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
        res.setHeader('Content-Security-Policy', "object-src 'none'; base-uri 'self'; frame-ancestors 'self'");
        if (prod) res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
        res.removeHeader('X-Powered-By');
        next();
    };
}

// ---------- NoSQL-injection guard: reject operator keys ($...) in user input ----------
function hasOperatorKey(v, depth = 0) {
    if (!v || typeof v !== 'object' || depth > 8) return false;
    for (const k of Object.keys(v)) {
        if (k.startsWith('$') || k.includes('[$') || hasOperatorKey(v[k], depth + 1)) return true;
    }
    return false;
}
function rejectOperatorInjection(req, res, next) {
    if (hasOperatorKey(req.body) || hasOperatorKey(req.query)) {
        return res.status(400).json({ success: false, message: 'Invalid input.' });
    }
    next();
}

// ---------- in-memory rate limiter (per instance) ----------
function rateLimiter({ windowMs, max, keyFn, message = 'Too many requests. Please try again shortly.' }) {
    const hits = new Map();
    const sweep = setInterval(() => {
        const now = Date.now();
        for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
    }, Math.min(windowMs, 60000));
    sweep.unref();
    const mw = (req, res, next) => {
        const key = (keyFn ? keyFn(req) : req.ip) || 'anon';
        const now = Date.now();
        let rec = hits.get(key);
        if (!rec || rec.reset <= now) { rec = { count: 0, reset: now + windowMs }; hits.set(key, rec); }
        rec.count += 1;
        if (hits.size > 50000) hits.clear(); // hard memory cap
        if (rec.count > max) {
            res.setHeader('Retry-After', Math.ceil((rec.reset - now) / 1000));
            return res.status(429).json({ success: false, message });
        }
        next();
    };
    mw._hits = hits; // exposed for tests
    return mw;
}

// Counts only FAILED attempts (4xx other than 429); a success clears the counter. Used for login brute-force protection.
function failureLimiter({ windowMs, max, keyFn, message }) {
    const hits = new Map();
    const sweep = setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (v.reset <= now) hits.delete(k); }, 60000);
    sweep.unref();
    const mw = (req, res, next) => {
        const key = keyFn(req) || 'anon';
        const now = Date.now();
        const rec = hits.get(key);
        if (rec && rec.reset > now && rec.count >= max) {
            res.setHeader('Retry-After', Math.ceil((rec.reset - now) / 1000));
            return res.status(429).json({ success: false, message });
        }
        res.on('finish', () => {
            const t = Date.now();
            if (res.statusCode >= 200 && res.statusCode < 300) { hits.delete(key); return; }
            if (res.statusCode >= 400 && res.statusCode < 500 && res.statusCode !== 429) {
                let r = hits.get(key);
                if (!r || r.reset <= t) { r = { count: 0, reset: t + windowMs }; hits.set(key, r); }
                r.count += 1;
                if (hits.size > 50000) hits.clear();
            }
        });
        next();
    };
    mw._hits = hits;
    return mw;
}

// ---------- CORS allowlist ----------
function corsOptionsDelegate() {
    const prod = process.env.NODE_ENV === 'production';
    const allowed = new Set(
        String(process.env.ALLOWED_ORIGINS || '')
            .split(',').map(s => s.trim().replace(/\/$/, '')).filter(Boolean)
    );
    ['https://mycampuscollective.me', 'https://www.mycampuscollective.me'].forEach(o => allowed.add(o));
    if (process.env.WEBSITE_HOSTNAME) allowed.add('https://' + process.env.WEBSITE_HOSTNAME); // set by Azure App Service
    if (!prod) ['http://localhost:8080', 'http://localhost:3000', 'http://127.0.0.1:8080', 'http://127.0.0.1:5500', 'http://localhost:5500'].forEach(o => allowed.add(o));
    return (req, cb) => {
        const origin = req.header('Origin');
        let ok = !origin; // non-browser / same-origin GETs send no Origin
        if (origin) {
            try { ok = allowed.has(origin.replace(/\/$/, '')) || new URL(origin).host === req.header('Host'); } catch (_) { ok = false; }
        }
        cb(null, {
            origin: ok ? (origin || false) : false,
            methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
            maxAge: 600,
            optionsSuccessStatus: 204,
        });
    };
}

// ---------- static file guard (replaces serving the whole project root) ----------
const BLOCKED_DIRS = new Set(['node_modules', 'routes', 'models', 'middleware', 'lib', 'tests', 'loadtest', 'app', '.git', '.github', 'scripts']);
const ALLOWED_EXT = new Set(['.html', '.htm', '.css', '.js', '.json', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.svg', '.ico', '.mp4', '.webm', '.pdf', '.woff', '.woff2', '.ttf', '.txt']);
const PRIVATE_UPLOAD_DIRS = new Set(['assistance', 'admin-files']);
const ROOT_JSON_OK = new Set(['postalcodes (1).json']);

function staticGuard(req, res, next) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    let p;
    try { p = decodeURIComponent(req.path); } catch (_) { return res.status(400).end(); }
    if (p.includes('\0') || p.includes('\\') || p.split('/').includes('..')) return res.status(400).end();
    const parts = p.split('/').filter(Boolean);
    if (!parts.length) return next();
    if (parts.some(s => s.startsWith('.'))) return res.status(404).end();
    if (BLOCKED_DIRS.has(parts[0])) return res.status(404).end();
    if (parts[0] === 'uploads' && parts.length > 1 && PRIVATE_UPLOAD_DIRS.has(parts[1])) return res.status(404).end(); // served via signed link only
    const file = parts[parts.length - 1];
    const dot = file.lastIndexOf('.');
    const ext = dot >= 0 ? file.slice(dot).toLowerCase() : '';
    if (parts.length === 1 && /^(server|db)\.js$/i.test(file)) return res.status(404).end();
    if (parts.length === 1 && ext === '.json' && !ROOT_JSON_OK.has(file)) return res.status(404).end(); // package.json etc.
    if (ext === '.js' && !(parts[0] === 'assets' || parts[0] === 'public')) return res.status(404).end();
    if (ext && !ALLOWED_EXT.has(ext)) return res.status(404).end();
    if (!ext && parts.length === 1) return res.status(404).end(); // extensionless root files
    next();
}

module.exports = { requestContext, securityHeaders, rejectOperatorInjection, rateLimiter, failureLimiter, corsOptionsDelegate, staticGuard, hasOperatorKey };
