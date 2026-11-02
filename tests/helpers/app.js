'use strict';
require('./env');
const http = require('http');
const mongoose = require('mongoose');
const { install } = require('./fakeDb');

const models = ['Session', 'Agent', 'User', 'Seller', 'Recruit', 'Season', 'Landlord', 'FormOtp', 'Signature', 'Student', 'Assistance', 'RoomCheck', 'Upload', 'Team'].map(n => require('../../models/' + n));
const db = install(models);
const mailer = require('../../lib/mailer');
const sent = [];
mailer._setTransporter({ sendMail: async (o) => { sent.push(o); return { ok: true }; } });

const { createApp } = require('../../server');
const pw = require('../../lib/password');

async function start() {
    const app = createApp();
    const server = http.createServer(app);
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${server.address().port}`;
    const call = async (method, path, { body, token, headers = {} } = {}) => {
        const res = await fetch(base + path, {
            method,
            headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}), ...headers },
            body: body ? JSON.stringify(body) : undefined,
        });
        let json = null; const text = await res.text();
        try { json = JSON.parse(text); } catch (_) {}
        return { status: res.status, json, text, headers: res.headers };
    };
    return { base, call, close: () => new Promise(r => server.close(r)) };
}

async function seedAgent(over = {}) {
    const password = over.password || 'Passw0rd!x';
    return db.seed(models.find(m => m.modelName === 'Agent'), {
        fullName: 'Test Admin', email: 'admin@test.local', phone: '0710000000', agentId: 'A001',
        password: await pw.hash(password), role: 'Admin', mustChangePassword: false, status: 'active', institution: 'UMP', ...over, ...(over.password ? { password: await pw.hash(password) } : {}),
    });
}

module.exports = { start, db, mailer, sent, models, seedAgent, pw, mongoose, M: Object.fromEntries(models.map(m => [m.modelName, m])) };
