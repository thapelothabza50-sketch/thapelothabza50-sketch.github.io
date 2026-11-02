'use strict';
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const T = require('./helpers/app');
const { db, M, seedAgent } = T;

let srv;
before(async () => { srv = await T.start(); });
after(async () => { await srv.close(); });
beforeEach(() => {
    db.reset(); T.sent.length = 0;
    T.mailer._setTransporter({ sendMail: async (o) => { T.sent.push(o); } });
    db.seed(M.Season, { name: 'First Semester 2027', isActive: true });
});

const form = (over = {}) => ({
    studentName: 'Thando', studentSurname: 'Nkosi', studentEmail: 'thando@example.com', studentPhone: '071 234 5678',
    gender: 'Female', studentNumber: '22012345', institution: 'University of Mpumalanga', yearOfStudy: '2nd Year',
    accommodation: 'Vuyani Res', roomType: 'Single', moveInDate: '2027-01-15', funding: 'NSFAS', nsfasStatus: 'Provisionally Approved',
    bursaryName: '', referencedBy: '', ...over,
});
const apply = (body) => srv.call('POST', '/api/auth/apply-for-accommodation', { body });
const nap = (ms) => new Promise(r => setTimeout(r, ms));

test('saves every collected field and reports success only after the write', async () => {
    const r = await apply(form());
    assert.equal(r.status, 201);
    assert.equal(r.json.success, true);
    const rec = db.all(M.Recruit)[0];
    assert.equal(rec.yearOfStudy, '2nd Year');
    assert.equal(rec.roomType, 'Single');
    assert.equal(rec.nsfasStatus, 'Provisionally Approved');
    assert.equal(rec.studentNumber, '22012345');
    assert.equal(rec.gender, 'Female');
    assert.equal(rec.institution, 'UMP');
    assert.equal(rec.institutionName, 'University of Mpumalanga');
    assert.equal(rec.funding, 'NSFAS');
    assert.equal(rec.studentPhone, '071 234 5678');
    assert.ok(rec.dedupeKey);
});

test('free-text institution no longer breaks validation (previously an enum error)', async () => {
    assert.equal((await apply(form({ institution: 'Some Other College', studentEmail: 'o@example.com' }))).status, 201);
    assert.equal(db.all(M.Recruit).find(r => r.studentEmail === 'o@example.com').institution, 'Other');
});

test('validation: missing/invalid fields return 400 and nothing is stored', async () => {
    assert.equal((await apply(form({ studentName: '' }))).status, 400);
    assert.equal((await apply(form({ studentEmail: 'not-an-email' }))).status, 400);
    assert.equal((await apply(form({ moveInDate: 'garbage' }))).status, 400);
    assert.equal((await apply(form({ roomType: 'Penthouse' }))).status, 400);
    assert.equal((await apply(form({ studentPhone: '12' }))).status, 400);
    assert.equal((await apply(form({ studentName: { $gt: '' } }))).status, 400);
    assert.equal(db.all(M.Recruit).length, 0);
});

test('iOS-style yyyy-mm-dd date from <input type=date> is accepted', async () => {
    assert.equal((await apply(form({ moveInDate: '2027-02-01' }))).status, 201);
});

test('a failed database write never produces a success response', async () => {
    db.control.failWrites = true;
    const r = await apply(form());
    assert.ok(r.status >= 500);
    assert.equal(r.json.success, false);
    assert.ok(!/success/i.test(r.json.message.replace(/not/i, '')) || r.json.success === false);
    db.control.failWrites = false;
    assert.equal(db.all(M.Recruit).length, 0);
});

test('repeat submission (double-click / retry) creates exactly one application', async () => {
    const results = await Promise.all(Array.from({ length: 10 }, () => apply(form())));
    assert.ok(results.every(r => r.status === 200 || r.status === 201));
    assert.equal(results.filter(r => r.status === 201).length, 1);
    assert.equal(db.all(M.Recruit).length, 1);
    const again = await apply(form());
    assert.equal(again.status, 200);
    assert.equal(again.json.duplicate, true);
});

test('e-mail failure does not undo or fail a saved application', async () => {
    T.mailer._setTransporter({ sendMail: async () => { throw new Error('SMTP down'); } });
    const r = await apply(form());
    assert.equal(r.status, 201);
    assert.equal(db.all(M.Recruit).length, 1);
});

test('a hanging SMTP server does not delay the response', async () => {
    T.mailer._setTransporter({ sendMail: () => new Promise(() => {}) });
    const t0 = Date.now();
    const r = await apply(form());
    assert.equal(r.status, 201);
    assert.ok(Date.now() - t0 < 1500);
});

test('confirmation e-mail is sent in the background and escapes user input', async () => {
    await apply(form({ studentName: '<script>alert(1)</script>' }));
    await nap(50);
    assert.equal(T.sent.length, 1);
    assert.ok(!T.sent[0].html.includes('<script>'));
});

test('room capacity: the last room cannot be taken twice (50 simultaneous applicants, 1 room)', async () => {
    db.seed(M.Landlord, { fullName: 'L', email: 'l@x.co', phone: '0711111111', propertyAddress: 'x', institution: 'UMP', nsfasAccredited: 'Yes', accommodationName: 'Vuyani Res', singleRoomsAvailable: 1 });
    const results = await Promise.all(Array.from({ length: 50 }, (_, i) => apply(form({ studentEmail: `s${i}@example.com` }))));
    assert.equal(results.filter(r => r.status === 201).length, 1);
    assert.equal(results.filter(r => r.status === 409).length, 49);
    assert.equal(db.all(M.Recruit).length, 1);
    const l = db.all(M.Landlord)[0];
    assert.equal(l.singleRoomsAvailable, 0);
    assert.equal(l.isSingleRoomFull, true);
});

test('room capacity is read from data, not hard-coded: sharing rooms still open when single is full', async () => {
    db.seed(M.Landlord, { fullName: 'L', email: 'l@x.co', phone: '0711111111', propertyAddress: 'x', institution: 'UMP', nsfasAccredited: 'Yes', accommodationName: 'Vuyani Res', isSingleRoomFull: true });
    assert.equal((await apply(form({ roomType: 'Single', studentEmail: 'a@example.com' }))).status, 409);
    assert.equal((await apply(form({ roomType: 'Sharing', studentEmail: 'b@example.com' }))).status, 201);
});

test('room is released when the save fails, and when an application is cancelled', async () => {
    db.seed(M.Landlord, { fullName: 'L', email: 'l@x.co', phone: '0711111111', propertyAddress: 'x', institution: 'UMP', nsfasAccredited: 'Yes', accommodationName: 'Vuyani Res', singleRoomsAvailable: 1 });
    db.control.failWrites = true;
    assert.ok((await apply(form())).status >= 500);
    db.control.failWrites = false;
    assert.equal(db.all(M.Landlord)[0].singleRoomsAvailable, 1, 'reservation rolled back');
    assert.equal((await apply(form())).status, 201);
    assert.equal(db.all(M.Landlord)[0].singleRoomsAvailable, 0);
    await seedAgent();
    const login = await srv.call('POST', '/api/auth/admin-agent/login', { body: { agentId: 'A001', password: 'Passw0rd!x' } });
    const id = String(db.all(M.Recruit)[0]._id);
    const up = await srv.call('POST', '/api/auth/update-status', { token: login.json.token, body: { recruitId: id, status: 'Cancelled' } });
    assert.equal(up.status, 200);
    assert.equal(db.all(M.Landlord)[0].singleRoomsAvailable, 1, 'room released on cancel');
    assert.equal(db.all(M.Landlord)[0].isSingleRoomFull, false);
});

test('public availability endpoint exposes flags only', async () => {
    db.seed(M.Landlord, { fullName: 'Secret Name', email: 'secret@x.co', phone: '0711111111', propertyAddress: 'x', institution: 'UMP', nsfasAccredited: 'Yes', accommodationName: 'Vuyani Res', isSingleRoomFull: true });
    const r = await srv.call('GET', '/api/auth/availability?name=Vuyani%20Res');
    assert.equal(r.status, 200);
    assert.equal(r.json.isSingleRoomFull, true);
    assert.ok(!r.text.includes('secret@x.co') && !r.text.includes('Secret Name'));
});

test('referral to a known agent links the recruit', async () => {
    await seedAgent({ agentId: 'AG7', role: 'Agent', fullName: 'John Smith', email: 'john@test.local' });
    const r = await apply(form({ referencedBy: 'Jon Smith' }));
    assert.equal(r.status, 201);
    assert.equal(r.json.agentLinked, true);
});

test('no active season gives a clear 400 (not a crash)', async () => {
    db.reset();
    const r = await apply(form());
    assert.equal(r.status, 400);
});
