'use strict';
// Load generator. Usage:  BASE_URL=https://staging.example node loadtest/run.js
// SAFETY: run ONLY against a staging/test deployment that uses a SEPARATE test database. All data is synthetic.
// It refuses to run against the production hostnames.
const BASE = (process.env.BASE_URL || '').replace(/\/$/, '');
const STAGES = (process.env.STAGES || '50,100,250,500,1000').split(',').map(Number);
const ACCOMMODATION = process.env.ACCOMMODATION || 'LOADTEST Residence';
const ROOM_TYPE = process.env.ROOM_TYPE || 'Sharing';
const LOGIN_ID = process.env.LOGIN_ID, LOGIN_PW = process.env.LOGIN_PW;   // optional synthetic test account

if (!BASE) { console.error('Set BASE_URL'); process.exit(2); }
if (/(^|\/\/)(www\.)?mycampuscollective\.me/i.test(BASE) && process.env.I_UNDERSTAND_THIS_IS_PRODUCTION !== 'never') {
    console.error('Refusing to load-test the production site.'); process.exit(2);
}

const pct = (a, p) => a.length ? a[Math.min(a.length - 1, Math.floor(a.length * p))] : 0;
const wait = (ms) => new Promise(r => setTimeout(r, ms));

async function one(kind, i, stage) {
    const t0 = performance.now();
    let status = 0, ok = false;
    try {
        const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 30000);
        let res;
        if (kind === 'apply') {
            res = await fetch(BASE + '/api/auth/apply-for-accommodation', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctl.signal,
                body: JSON.stringify({ studentName: 'Load', studentSurname: 'Test' + i, studentEmail: `loadtest.${stage}.${i}.${Date.now()}@example.invalid`, studentPhone: '0712345678',
                    gender: 'Other', studentNumber: String(20000000 + i), institution: 'Other', yearOfStudy: '1st Year', accommodation: ACCOMMODATION, roomType: ROOM_TYPE,
                    moveInDate: '2027-01-15', funding: 'Self-Funded' }),
            });
        } else {
            res = await fetch(BASE + '/api/auth/admin-agent/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctl.signal, body: JSON.stringify({ agentId: LOGIN_ID, password: LOGIN_PW }) });
        }
        clearTimeout(to); status = res.status; await res.text();
        ok = kind === 'apply' ? (status === 201 || status === 200 || status === 409) : status === 200;   // 409 = correctly refused (room full)
    } catch (e) { status = 0; }
    return { ms: performance.now() - t0, status, ok };
}

async function stage(kind, n, label) {
    const t0 = performance.now();
    const results = await Promise.all(Array.from({ length: n }, (_, i) => one(kind, i, label)));
    const secs = (performance.now() - t0) / 1000;
    const lat = results.map(r => r.ms).sort((a, b) => a - b);
    const byStatus = {}; results.forEach(r => { byStatus[r.status] = (byStatus[r.status] || 0) + 1; });
    const okc = results.filter(r => r.ok).length;
    const row = { kind, concurrent: n, seconds: +secs.toFixed(2), rps: +(n / secs).toFixed(1), successPct: +(100 * okc / n).toFixed(2),
        p50: Math.round(pct(lat, .5)), p95: Math.round(pct(lat, .95)), p99: Math.round(pct(lat, .99)), max: Math.round(lat[lat.length - 1] || 0), byStatus };
    console.log(JSON.stringify(row));
    return row;
}

(async () => {
    const h = await fetch(BASE + '/ready').then(r => r.status).catch(() => 0);
    console.log('ready check:', h);
    const rows = [];
    for (const n of STAGES) { rows.push(await stage('apply', n, 's' + n)); await wait(2000); }
    const LOGIN_STAGES = (process.env.LOGIN_STAGES || process.env.STAGES || '50,100').split(',').map(Number);
    if (LOGIN_ID && LOGIN_PW) for (const n of LOGIN_STAGES) { rows.push(await stage('login', n, 'l' + n)); await wait(2000); }
    console.log('SUMMARY ' + JSON.stringify(rows.map(r => ({ k: r.kind, c: r.concurrent, ok: r.successPct, p95: r.p95, p99: r.p99, rps: r.rps }))));
})();
