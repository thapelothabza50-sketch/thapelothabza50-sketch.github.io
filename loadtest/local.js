'use strict';
// Local run against the REAL application code with an in-memory stand-in for MongoDB (no network, no real DB).
// It measures the Node layer only (HTTP, validation, sessions, bcrypt, rate limiting). Simulated DB latency is added.
// It does NOT prove MongoDB / Atlas / Azure capacity - run loadtest/run.js against staging for that.
process.env.RL_LOGIN_PER_IP = '1000000'; process.env.RL_APPLY_PER_MIN_IP = '1000000'; process.env.RL_API_PER_MIN = '1000000';
process.env.RL_APPLY_PER_EMAIL = '1000000'; process.env.BCRYPT_COST = process.env.BCRYPT_COST || '10';
require('../tests/helpers/env'); process.env.BCRYPT_COST = '10'; process.env.SESSION_CACHE_MS = '10000'; process.env.RL_LOGIN_PER_IP = '1000000';
const { spawn } = require('child_process');
const T = require('../tests/helpers/app');
const DB_LATENCY_MS = Number(process.env.DB_LATENCY_MS || 8);
const CAPACITY = 400;

(async () => {
    const srv = await T.start();
    T.db.control.writeDelayMs = DB_LATENCY_MS;
    T.db.seed(T.M.Season, { name: 'LOAD', isActive: true });
    T.db.seed(T.M.Landlord, { fullName: 'L', email: 'l@x.invalid', phone: '0711111111', propertyAddress: 'x', institution: 'UMP', nsfasAccredited: 'Yes', accommodationName: 'LOADTEST Residence', singleRoomsAvailable: CAPACITY });
    await T.seedAgent({ agentId: 'LOAD1', email: 'load@x.invalid', password: 'Load-Test-Pass-1' });
    process.env.BASE_URL = srv.base; process.env.LOGIN_ID = 'LOAD1'; process.env.LOGIN_PW = 'Load-Test-Pass-1'; process.env.ROOM_TYPE = process.env.ROOM_TYPE || 'Single';
    const cpu0 = process.cpuUsage(); const t0 = Date.now();
    const peak = { rss: 0 }; const iv = setInterval(() => { peak.rss = Math.max(peak.rss, process.memoryUsage().rss); }, 200);
    const r = await new Promise(res => spawn(process.execPath, [require('path').join(__dirname, 'run.js')], { env: process.env, stdio: 'inherit' }).on('exit', c => res({ status: c })));
    clearInterval(iv);
    const cpu = process.cpuUsage(cpu0); const wall = (Date.now() - t0) / 1000;
    const recs = T.db.all(T.M.Recruit); const l = T.db.all(T.M.Landlord)[0];
    console.log(JSON.stringify({
        serverCpuPctOfOneCore: +(((cpu.user + cpu.system) / 1e6) / wall * 100).toFixed(1), peakRssMB: Math.round(peak.rss / 1048576),
        recruitsStored: recs.length, singleRoomCapacity: CAPACITY, roomsLeft: l.singleRoomsAvailable, overbooked: recs.filter(x => x.roomType === 'Single').length > CAPACITY || l.singleRoomsAvailable < 0,
        simulatedDbWriteLatencyMs: DB_LATENCY_MS,
    }));
    await srv.close(); process.exit(r.status || 0);
})();
