'use strict';
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const Session = require('../models/Session');

const STAFF = ['admin', 'restrictedadmin', 'agent'];
const kindFor = (role) => {
    const r = String(role || '').toLowerCase();
    if (STAFF.includes(r)) return 'Agent';
    if (r === 'seller') return 'Seller';
    return 'User';
};

const TTL = () => ({
    staff: process.env.SESSION_TTL_STAFF || '12h',
    seller: process.env.SESSION_TTL_SELLER || '24h',
    customer: process.env.SESSION_TTL_CUSTOMER || '7d',
    reset: '15m',
});
function ttlFor(role, scope) {
    if (scope === 'reset') return TTL().reset;
    const k = kindFor(role);
    return k === 'Agent' ? TTL().staff : k === 'Seller' ? TTL().seller : TTL().customer;
}
const toMs = (s) => { const m = /^(\d+)\s*([smhd])$/.exec(s); return m ? Number(m[1]) * { s: 1e3, m: 6e4, h: 36e5, d: 864e5 }[m[2]] : 36e5; };

// Roles that may only hold ONE active login. Customers may use several devices by default.
const singleSessionRoles = () => String(process.env.SINGLE_SESSION_ROLES || 'admin,restrictedadmin,agent,seller')
    .toLowerCase().split(',').map(s => s.trim()).filter(Boolean);

const cache = new Map(); // jti -> { ok, until }
const CACHE_MS = () => parseInt(process.env.SESSION_CACHE_MS, 10) >= 0 ? parseInt(process.env.SESSION_CACHE_MS, 10) : 10000;

function getSecret() {
    const s = process.env.JWT_SECRET;
    if (!s) throw new Error('JWT_SECRET is not set');
    return s;
}

async function issueSession(payload, { scope = 'full' } = {}) {
    const role = payload.role;
    const kind = kindFor(role);
    const jti = crypto.randomBytes(16).toString('hex');
    const expiresIn = ttlFor(role, scope);
    const expiresAt = new Date(Date.now() + toMs(expiresIn));

    if (scope === 'full' && singleSessionRoles().includes(String(role).toLowerCase())) {
        const old = await Session.find({ userId: payload.id, kind, revokedAt: null, scope: 'full' }).select('jti').lean();
        if (old.length) {
            await Session.updateMany({ userId: payload.id, kind, revokedAt: null, scope: 'full' },
                { revokedAt: new Date(), revokedReason: 'replaced_by_new_login' });
            old.forEach(s => cache.delete(s.jti));
        }
    }
    await Session.create({ jti, userId: payload.id, kind, role, scope, expiresAt });
    const token = jwt.sign({ ...payload, jti, scope }, getSecret(), { algorithm: 'HS256', expiresIn });
    return { token, jti, expiresAt };
}

async function revokeSession(jti, reason = 'logout') {
    cache.delete(jti);
    await Session.updateOne({ jti, revokedAt: null }, { revokedAt: new Date(), revokedReason: reason });
}

async function revokeAllForUser(userId, role, reason = 'password_changed') {
    const kind = kindFor(role);
    const rows = await Session.find({ userId, kind, revokedAt: null }).select('jti').lean();
    await Session.updateMany({ userId, kind, revokedAt: null }, { revokedAt: new Date(), revokedReason: reason });
    rows.forEach(r => cache.delete(r.jti));
}

function verifyToken(token) {
    return jwt.verify(token, getSecret(), { algorithms: ['HS256'] });
}

async function isSessionActive(jti) {
    const c = cache.get(jti);
    if (c && c.until > Date.now()) return c.ok;
    const s = await Session.findOne({ jti }).select('revokedAt expiresAt').lean();
    const ok = !!s && !s.revokedAt && s.expiresAt > new Date();
    if (CACHE_MS() > 0) cache.set(jti, { ok, until: Date.now() + CACHE_MS() });
    if (cache.size > 20000) cache.clear();
    return ok;
}

module.exports = { issueSession, revokeSession, revokeAllForUser, verifyToken, isSessionActive, kindFor, _cache: cache };
