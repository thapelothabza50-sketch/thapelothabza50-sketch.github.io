'use strict';
// Structured JSON logger. Never logs request bodies, tokens, passwords or full e-mail addresses.
const REDACT = /pass(word)?|token|secret|authorization|cookie|otp|code|apikey|api_key|signature/i;

function maskEmail(value) {
    return String(value).replace(/([^@\s]{1,2})[^@\s]*@([^@\s]+)/g, '$1***@$2');
}

function clean(value, depth = 0) {
    if (value == null) return value;
    if (typeof value === 'string') return maskEmail(value).slice(0, 500);
    if (typeof value !== 'object') return value;
    if (depth > 3) return '[truncated]';
    if (Array.isArray(value)) return value.slice(0, 10).map(v => clean(v, depth + 1));
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = REDACT.test(k) ? '[redacted]' : clean(v, depth + 1);
    return out;
}

function write(level, msg, meta) {
    const line = { time: new Date().toISOString(), level, msg: maskEmail(msg), ...(meta ? clean(meta) : {}) };
    const out = JSON.stringify(line);
    (level === 'error' || level === 'warn' ? process.stderr : process.stdout).write(out + '\n');
}

function errMeta(err) {
    if (!err) return {};
    return { err: maskEmail(err.message || String(err)), errName: err.name, errCode: err.code, stack: process.env.NODE_ENV === 'production' ? undefined : err.stack };
}

module.exports = {
    info: (msg, meta) => write('info', msg, meta),
    warn: (msg, meta) => write('warn', msg, meta),
    error: (msg, meta) => write('error', msg, meta),
    errMeta,
    maskEmail,
};
