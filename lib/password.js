'use strict';
// Native bcrypt runs on libuv's thread pool; bcryptjs runs on the event loop and stalls every request under load.
let impl;
try { impl = require('bcrypt'); } catch (_) { impl = require('bcryptjs'); }
const COST = Math.min(Math.max(parseInt(process.env.BCRYPT_COST, 10) || 10, 8), 14);
const DUMMY = '$2b$10$CwTycUXWue0Thq9StjUM0uJ8.4M0jP3wYd6zx9F0hhHkNtD8vqZ0m'; // for constant-time-ish unknown-user compare

module.exports = {
    hash: (plain) => impl.hash(String(plain), COST),
    compare: (plain, hash) => impl.compare(String(plain), String(hash || DUMMY)).catch(() => false),
    burn: (plain) => impl.compare(String(plain || ''), DUMMY).catch(() => false),
    isBcryptHash: (s) => typeof s === 'string' && /^\$2[aby]\$\d{2}\$/.test(s),
};
