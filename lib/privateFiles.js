'use strict';
// Sensitive uploads (student ID / academic documents, contracts) are NOT served from /uploads.
// An authenticated admin requests a short-lived signed link; the link is then opened in a new tab.
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const express = require('express');
const { auth, hasRole } = require('../middleware/auth');

const DIRS = new Set(['assistance', 'admin-files']);
const UPLOADS = path.join(__dirname, '..', 'uploads');
const TTL_MS = 10 * 60 * 1000;

const secret = () => crypto.createHash('sha256').update('private-files|' + (process.env.JWT_SECRET || '')).digest();
const sign = (dir, file, exp) => crypto.createHmac('sha256', secret()).update(`${dir}/${file}/${exp}`).digest('hex');

function parseStoredPath(p) {
    const m = /^\/?uploads\/([a-z-]+)\/([^/\\]+)$/i.exec(String(p || ''));
    if (!m || !DIRS.has(m[1]) || m[2].startsWith('.') || m[2] !== path.basename(m[2])) return null;
    return { dir: m[1], file: m[2] };
}

const router = express.Router();

// GET /api/auth/private-file-link?path=/uploads/assistance/123-id.pdf
router.get('/api/auth/private-file-link', auth, hasRole(['Admin', 'RestrictedAdmin']), (req, res) => {
    const f = parseStoredPath(req.query.path);
    if (!f) return res.status(400).json({ message: 'Invalid file path.' });
    const exp = Date.now() + TTL_MS;
    res.json({ url: `/private-files/${f.dir}/${encodeURIComponent(f.file)}?exp=${exp}&sig=${sign(f.dir, f.file, exp)}` });
});

router.get('/private-files/:dir/:file', (req, res) => {
    const { dir, file } = req.params;
    const exp = Number(req.query.exp);
    const sig = String(req.query.sig || '');
    if (!DIRS.has(dir) || file !== path.basename(file) || file.startsWith('.') || !exp || exp < Date.now()) return res.status(403).end();
    const expected = sign(dir, file, exp);
    if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return res.status(403).end();
    const full = path.join(UPLOADS, dir, file);
    if (!full.startsWith(path.join(UPLOADS, dir) + path.sep) || !fs.existsSync(full)) return res.status(404).end();
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    res.setHeader('Cache-Control', 'private, no-store');
    res.sendFile(full);
});

module.exports = { router, parseStoredPath, sign };
