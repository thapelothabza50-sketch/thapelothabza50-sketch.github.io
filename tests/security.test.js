'use strict';
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const path = require('path');
const T = require('./helpers/app');
const { db, M, seedAgent } = T;
let srv;
before(async () => { srv = await T.start(); });
after(async () => { await srv.close(); });
beforeEach(() => db.reset());

test('static hosting no longer exposes source, config, dependencies or private uploads', async () => {
    for (const p of ['/server.js', '/db.js', '/package.json', '/package-lock.json', '/.env', '/.git/config', '/.github/workflows/main_campus-collective.yml',
        '/routes/authRoutes.js', '/models/User.js', '/middleware/auth.js', '/lib/session.js', '/node_modules/express/package.json', '/middleware.ts', '/README.md',
        '/uploads/assistance/x.pdf', '/uploads/admin-files/x.pdf', '/%2e%2e/server.js', '/..%2fserver.js', '/uploads/..%2f..%2fserver.js', '/classwork']) {
        const r = await srv.call('GET', p);
        assert.ok([400, 404].includes(r.status), `${p} should be blocked, got ${r.status}`);
    }
});

test('legitimate pages and assets are still served', async () => {
    for (const p of ['/', '/index.html', '/apply.html', '/Admin.html', '/assets/cc-ui.js', '/assets/cc-theme.css', '/postalcodes%20(1).json']) {
        const r = await srv.call('GET', p);
        assert.equal(r.status, 200, p);
    }
    const img = fs.readdirSync(path.join(__dirname, '..', 'uploads')).find(f => /\.(png|jpe?g)$/i.test(f));
    if (img) assert.equal((await srv.call('GET', '/uploads/' + img)).status, 200);
    const im2 = fs.readdirSync(path.join(__dirname, '..', 'Images')).find(f => /\.(png|jpe?g)$/i.test(f));
    assert.equal((await srv.call('GET', '/Images/' + encodeURIComponent(im2))).status, 200);
});

test('CORS: allow-listed and same-origin pass, foreign origins get no CORS headers', async () => {
    const ok = await srv.call('GET', '/api/shop/products', { headers: { Origin: 'https://www.mycampuscollective.me' } });
    assert.equal(ok.headers.get('access-control-allow-origin'), 'https://www.mycampuscollective.me');
    const same = await srv.call('GET', '/api/shop/products', { headers: { Origin: srv.base } });
    assert.equal(same.headers.get('access-control-allow-origin'), srv.base);
    const evil = await srv.call('GET', '/api/shop/products', { headers: { Origin: 'https://evil.example' } });
    assert.equal(evil.headers.get('access-control-allow-origin'), null);
    const pre = await srv.call('OPTIONS', '/api/auth/apply-for-accommodation', { headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'POST' } });
    assert.equal(pre.headers.get('access-control-allow-origin'), null);
    const pre2 = await srv.call('OPTIONS', '/api/auth/apply-for-accommodation', { headers: { Origin: 'https://mycampuscollective.me', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type,authorization' } });
    assert.equal(pre2.status, 204);
    assert.match(pre2.headers.get('access-control-allow-headers'), /authorization/i);
});

test('security headers present', async () => {
    const r = await srv.call('GET', '/apply.html');
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(r.headers.get('x-frame-options'), 'SAMEORIGIN');
    assert.ok(r.headers.get('referrer-policy'));
    assert.equal(r.headers.get('x-powered-by'), null);
});

test('malformed JSON -> 400, oversized body -> 413, operator keys -> 400, all as JSON', async () => {
    const bad = await fetch(srv.base + '/api/auth/customer/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad json' });
    assert.equal(bad.status, 400);
    const big = await fetch(srv.base + '/api/auth/customer/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'a', password: 'x'.repeat(2 * 1024 * 1024) }) });
    assert.equal(big.status, 413);
    const inj = await srv.call('POST', '/api/auth/customer/login', { body: { email: { $gt: '' }, password: 'x' } });
    assert.equal(inj.status, 400);
    const inj2 = await srv.call('GET', '/api/shop/products?name[$ne]=x');
    assert.equal(inj2.status, 400);
});

test('/health is always up; /ready is 503 without a database', async () => {
    assert.equal((await srv.call('GET', '/health')).status, 200);
    const r = await srv.call('GET', '/ready');
    assert.equal(r.status, 503);
    assert.equal(r.json.database, 'down');
});

test('private documents: only admins get a signed, expiring, tamper-proof link', async () => {
    fs.mkdirSync(path.join(__dirname, '..', 'uploads', 'assistance'), { recursive: true });
    const f = path.join(__dirname, '..', 'uploads', 'assistance', 'test-doc.pdf');
    fs.writeFileSync(f, '%PDF-1.4 test');
    try {
        await seedAgent();
        const tok = (await srv.call('POST', '/api/auth/admin-agent/login', { body: { agentId: 'A001', password: 'Passw0rd!x' } })).json.token;
        assert.equal((await srv.call('GET', '/api/auth/private-file-link?path=/uploads/assistance/test-doc.pdf')).status, 401);
        assert.equal((await srv.call('GET', '/api/auth/private-file-link?path=/uploads/../server.js', { token: tok })).status, 400);
        assert.equal((await srv.call('GET', '/api/auth/private-file-link?path=/uploads/landlords/x.jpg', { token: tok })).status, 400);
        const link = await srv.call('GET', '/api/auth/private-file-link?path=/uploads/assistance/test-doc.pdf', { token: tok });
        assert.equal(link.status, 200);
        const ok = await srv.call('GET', link.json.url);
        assert.equal(ok.status, 200);
        assert.equal((await srv.call('GET', link.json.url.replace(/sig=./, 'sig=0'))).status, 403);
        assert.equal((await srv.call('GET', link.json.url.replace(/exp=\d+/, 'exp=1000'))).status, 403);
        assert.equal((await srv.call('GET', '/private-files/assistance/test-doc.pdf')).status, 403);
    } finally { fs.unlinkSync(f); }
});

test('API returns a clean 503 (not a hang) when MongoDB is unavailable', async () => {
    const prev = process.env.SKIP_DB_GUARD;
    process.env.SKIP_DB_GUARD = '0';
    try {
        const r = await srv.call('POST', '/api/auth/apply-for-accommodation', { body: { studentName: 'a' } });
        assert.equal(r.status, 503);
        assert.equal(r.headers.get('retry-after'), '5');
        assert.equal((await srv.call('GET', '/index.html')).status, 200, 'static pages still load');
    } finally { process.env.SKIP_DB_GUARD = prev; }
});

test('uploads: executable/SVG/HTML files are rejected by the upload filter', () => {
    const { fileFilter } = require('../lib/upload');
    const run = (name, mime, kind = 'doc') => new Promise(res => fileFilter(kind)({}, { originalname: name, mimetype: mime }, (e, ok) => res(!e && ok)));
    return Promise.all([
        run('a.pdf', 'application/pdf').then(v => assert.equal(v, true)),
        run('a.jpg', 'image/jpeg', 'image').then(v => assert.equal(v, true)),
        run('a.svg', 'image/svg+xml', 'image').then(v => assert.equal(v, false)),
        run('a.html', 'text/html').then(v => assert.equal(v, false)),
        run('a.php.jpg', 'text/x-php', 'image').then(v => assert.equal(v, false)),
        run('a.exe', 'application/octet-stream').then(v => assert.equal(v, false)),
    ]);
});

test('application endpoint is rate limited per e-mail address', async () => {
    const prev = process.env.RL_APPLY_PER_EMAIL; process.env.RL_APPLY_PER_EMAIL = '3';
    const s2 = await T.start(); process.env.RL_APPLY_PER_EMAIL = prev;
    try {
        let last;
        for (let i = 0; i < 5; i++) last = await s2.call('POST', '/api/auth/apply-for-accommodation', { body: { studentEmail: 'same@x.co' } });
        assert.equal(last.status, 429);
    } finally { await s2.close(); }
});
