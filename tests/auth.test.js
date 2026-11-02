'use strict';
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const T = require('./helpers/app');
const { db, M, seedAgent } = T;

let srv;
before(async () => { srv = await T.start(); });
after(async () => { await srv.close(); });
beforeEach(() => db.reset());

const login = (id = 'A001', password = 'Passw0rd!x') => srv.call('POST', '/api/auth/admin-agent/login', { body: { agentId: id, password } });

test('valid user can log in and receives a session-bound token', async () => {
    await seedAgent();
    const r = await login();
    assert.equal(r.status, 200);
    assert.ok(r.json.token);
    const decoded = jwt.decode(r.json.token);
    assert.ok(decoded.jti, 'token carries a session id');
    assert.equal(r.json.user.role, 'Admin');
    assert.equal(db.all(M.Session).length, 1);
});

test('invalid password and unknown id are rejected identically (no account enumeration)', async () => {
    await seedAgent();
    const bad = await login('A001', 'wrong-password');
    const unknown = await login('NOPE', 'whatever');
    assert.equal(bad.status, 401);
    assert.equal(unknown.status, 401);
    assert.deepEqual(bad.json, unknown.json);
});

test('locked account cannot log in', async () => {
    await seedAgent({ status: 'locked' });
    assert.equal((await login()).status, 403);
});

test('protected route: missing, malformed, wrong-secret and alg=none tokens are rejected', async () => {
    await seedAgent();
    assert.equal((await srv.call('GET', '/api/auth/agents')).status, 401);
    assert.equal((await srv.call('GET', '/api/auth/agents', { token: 'garbage' })).status, 401);
    const forged = jwt.sign({ id: 'x', role: 'Admin', jti: 'abc' }, 'another-secret');
    assert.equal((await srv.call('GET', '/api/auth/agents', { token: forged })).status, 401);
    const none = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url') + '.' + Buffer.from(JSON.stringify({ id: 'x', role: 'Admin', jti: 'abc' })).toString('base64url') + '.';
    assert.equal((await srv.call('GET', '/api/auth/agents', { token: none })).status, 401);
});

test('a validly signed token with no server-side session is rejected', async () => {
    const a = await seedAgent();
    const t = jwt.sign({ id: String(a._id), role: 'Admin', jti: 'not-a-real-session', scope: 'full' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    assert.equal((await srv.call('GET', '/api/auth/agents', { token: t })).status, 401);
});

test('expired token is rejected', async () => {
    const a = await seedAgent();
    const t = jwt.sign({ id: String(a._id), role: 'Admin', jti: 'x', scope: 'full' }, process.env.JWT_SECRET, { expiresIn: -10 });
    assert.equal((await srv.call('GET', '/api/auth/agents', { token: t })).status, 401);
});

test('logout revokes the session immediately', async () => {
    await seedAgent();
    const { json } = await login();
    assert.equal((await srv.call('GET', '/api/auth/agents', { token: json.token })).status, 200);
    assert.equal((await srv.call('POST', '/api/auth/logout', { token: json.token })).status, 200);
    assert.equal((await srv.call('GET', '/api/auth/agents', { token: json.token })).status, 401);
});

test('one active session per staff user: a new login replaces the previous one', async () => {
    await seedAgent();
    const first = (await login()).json.token;
    const second = (await login()).json.token;
    assert.equal((await srv.call('GET', '/api/auth/agents', { token: first })).status, 401);
    assert.equal((await srv.call('GET', '/api/auth/agents', { token: second })).status, 200);
});

test('locking an account ends access on the next request', async () => {
    const a = await seedAgent();
    const { json } = await login();
    db.all(M.Agent).find(x => String(x._id) === String(a._id)).status = 'locked';
    assert.equal((await srv.call('GET', '/api/auth/agents', { token: json.token })).status, 403);
});

test('role comes from the database: a demoted admin loses admin access immediately', async () => {
    const a = await seedAgent();
    const { json } = await login();
    db.all(M.Agent).find(x => String(x._id) === String(a._id)).role = 'Agent';
    assert.equal((await srv.call('GET', '/api/auth/agents', { token: json.token })).status, 403);
});

test('agent cannot reach admin functions; unauthenticated cannot read student data', async () => {
    await seedAgent({ agentId: 'AG1', role: 'Agent', email: 'ag@test.local' });
    const { json } = await login('AG1');
    assert.equal((await srv.call('GET', '/api/admin/profiles', { token: json.token })).status, 403);
    assert.equal((await srv.call('GET', '/api/auth/admin/students', { token: json.token })).status, 403);
    assert.equal((await srv.call('GET', '/api/auth/admin/students')).status, 401);
    assert.equal((await srv.call('GET', '/api/auth/admin/landlords')).status, 401);
    assert.equal((await srv.call('GET', '/api/auth/admin/assistance')).status, 401);
    assert.equal((await srv.call('POST', '/api/auth/admin/toggle-room/abc', { body: { roomType: 'single', status: true } })).status, 401);
    assert.equal((await srv.call('POST', '/api/auth/admin/approve-seller/abc')).status, 401);
    assert.equal((await srv.call('GET', '/api/auth/signatures/abc')).status, 401);
});

test('IDOR: an agent cannot delete or edit another agent\'s recruit; unassigned recruits do not crash', async () => {
    const a1 = await seedAgent({ agentId: 'AG1', role: 'Agent', email: 'a1@test.local' });
    const a2 = await seedAgent({ agentId: 'AG2', role: 'Agent', email: 'a2@test.local' });
    const season = db.seed(M.Season, { name: 'S1', isActive: true });
    const mk = (agent) => db.seed(M.Recruit, { agent, season: season._id, studentName: 'A', studentSurname: 'B', studentEmail: `${Math.random()}@x.co`, studentPhone: '0711111111', accommodation: 'Res', moveInDate: new Date() });
    const mine = mk(a1._id), theirs = mk(a2._id), unassigned = mk(null);
    const t1 = (await login('AG1')).json.token;
    assert.equal((await srv.call('DELETE', `/api/auth/recruit/${theirs._id}`, { token: t1 })).status, 403);
    assert.equal((await srv.call('PUT', `/api/auth/recruit/${theirs._id}`, { token: t1, body: { studentName: 'Hacked' } })).status, 403);
    assert.equal((await srv.call('DELETE', `/api/auth/recruit/${unassigned._id}`, { token: t1 })).status, 403);   // previously a 500 crash
    assert.equal((await srv.call('DELETE', `/api/auth/recruit/${mine._id}`, { token: t1 })).status, 200);
});

test('NoSQL operator injection in login is rejected', async () => {
    await seedAgent();
    const r = await srv.call('POST', '/api/auth/admin-agent/login', { body: { agentId: { $ne: '' }, password: { $ne: '' } } });
    assert.equal(r.status, 400);
});

test('first-login: reset token only works for password setup; the new password then logs in (no double hashing)', async () => {
    await seedAgent({ agentId: 'NEW1', role: 'Agent', email: 'new@test.local', password: 'Temp-Pass-1', mustChangePassword: true });
    const first = await login('NEW1', 'Temp-Pass-1');
    assert.equal(first.json.action, 'MANDATORY_RESET');
    const resetToken = first.json.token;
    assert.equal((await srv.call('GET', '/api/auth/agents', { token: resetToken })).status, 403, 'reset token is not a full session');
    assert.equal((await srv.call('GET', '/api/auth/current-user', { token: resetToken })).status, 200);
    const done = await srv.call('POST', '/api/auth/complete-agent-setup', { token: resetToken, body: { firstName: 'Jo', surname: 'Dlamini', password: 'My-New-Password-9' } });
    assert.equal(done.status, 200);
    assert.ok(done.json.token, 'a fresh full-session token is returned');
    assert.equal((await srv.call('GET', '/api/auth/current-user', { token: resetToken })).status, 401, 'temporary session is ended');
    const again = await login('NEW1', 'My-New-Password-9');
    assert.equal(again.status, 200, 'agent can log in with the new password');
    assert.ok(again.json.token);
    const weak = await srv.call('POST', '/api/auth/complete-agent-setup', { token: again.json.token, body: { firstName: 'a', surname: 'b', password: 'short' } });
    assert.equal(weak.status, 400);
});

test('customers may keep several sessions; customer role cannot use staff routes', async () => {
    const c = await srv.call('POST', '/api/auth/customer/register', { body: { firstName: 'C', surname: 'D', phone: '0712345678', email: 'cust@test.local', password: 'Customer-Pass-1' } });
    assert.equal(c.status, 201);
    const l1 = await srv.call('POST', '/api/auth/customer/login', { body: { email: 'cust@test.local', password: 'Customer-Pass-1' } });
    const l2 = await srv.call('POST', '/api/auth/customer/login', { body: { email: 'CUST@test.local', password: 'Customer-Pass-1' } });
    assert.equal(l1.status, 200); assert.equal(l2.status, 200);
    assert.equal((await srv.call('GET', '/api/auth/user/me', { token: l1.json.token })).status, 200);
    assert.equal((await srv.call('GET', '/api/auth/user/me', { token: c.json.token })).status, 200);
    assert.equal((await srv.call('GET', '/api/auth/agents', { token: l1.json.token })).status, 403);
    assert.equal((await srv.call('POST', '/api/auth/customer/login', { body: { email: 'cust@test.local', password: 'nope' } })).status, 400);
});

test('password reset: code is really verified (account takeover by e-mail alone is impossible)', async () => {
    const A = await seedAgent({ agentId: 'ADM9', email: 'victim@test.local' });
    T.sent.length = 0;
    const f = await srv.call('POST', '/api/auth/forgot-password', { body: { email: 'victim@test.local' } });
    assert.equal(f.status, 200);
    const unknown = await srv.call('POST', '/api/auth/forgot-password', { body: { email: 'nobody@test.local' } });
    assert.deepEqual(unknown.json, f.json, 'same answer for unknown e-mail');
    const code = />(\d{6})</.exec(T.sent.map(m => m.html).join(" "))[1];
    const stored = db.all(M.Agent)[0];
    assert.notEqual(stored.resetCode, code, 'code is stored hashed');
    // attacker without the code
    assert.equal((await srv.call('POST', '/api/auth/reset-password', { body: { email: 'victim@test.local', newPassword: 'Attacker-Pass-1' } })).status, 400);
    assert.equal((await srv.call('POST', '/api/auth/reset-password', { body: { email: 'victim@test.local', code: '000000', newPassword: 'Attacker-Pass-1' } })).status, 400);
    assert.equal((await login('ADM9', 'Attacker-Pass-1')).status, 401);
    // legitimate owner
    const ok = await srv.call('POST', '/api/auth/reset-password', { body: { email: 'victim@test.local', code, newPassword: 'Owner-New-Pass-1' } });
    assert.equal(ok.status, 200);
    assert.equal((await login('ADM9', 'Owner-New-Pass-1')).status, 200);
    // code is single use
    assert.equal((await srv.call('POST', '/api/auth/reset-password', { body: { email: 'victim@test.local', code, newPassword: 'Second-Use-Pass-1' } })).status, 400);
});

test('login brute force is throttled (failed attempts only)', async () => {
    await seedAgent();
    let last;
    for (let i = 0; i < 12; i++) last = await login('A001', 'wrong-' + i);
    assert.equal(last.status, 429);
    assert.ok(last.headers.get('retry-after'));
});
