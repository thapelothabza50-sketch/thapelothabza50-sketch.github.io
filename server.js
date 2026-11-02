require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const connectDB = require('./db');
const logger = require('./lib/logger');
const sec = require('./lib/security');
const privateFiles = require('./lib/privateFiles');

// Route Imports
const authRoutes = require('./routes/authRoutes.js');
const adminRoutes = require('./routes/adminRoutes.js');
const sellerRoutes = require('./routes/sellerRoutes.js');
const sellerOrderRoutes = require('./routes/sellerOrderRoutes.js');
const shopRoutes = require('./routes/shopRoutes.js');
const orderRoutes = require('./routes/orderRoutes.js');
const assistanceRoutes = require('./routes/assistanceRoutes');
const agentRoutes = require('./routes/agentRoutes.js');

const PORT = process.env.PORT || 8080;
const IMAGE_EXT = /\.(jpe?g|png|gif|webp|avif)$/i;

function createApp() {
    const app = express();
    app.disable('x-powered-by');
    app.set('trust proxy', process.env.TRUST_PROXY === undefined ? 1 : (isNaN(Number(process.env.TRUST_PROXY)) ? process.env.TRUST_PROXY : Number(process.env.TRUST_PROXY)));

    app.use(sec.requestContext({ timeoutMs: Number(process.env.REQUEST_TIMEOUT_MS) || 30000 }));
    app.use(sec.securityHeaders());

    // --- Health: /health = process is up; /ready = process AND database are usable ---
    app.get('/health', (req, res) => res.json({ status: 'ok', uptime: Math.round(process.uptime()) }));
    app.get('/ready', async (req, res) => {
        const dbOk = await connectDB.ping();
        res.status(dbOk ? 200 : 503).json({ status: dbOk ? 'ready' : 'not_ready', database: dbOk ? 'up' : 'down' });
    });

    // --- Static files: allow-listed (no source, config, node_modules or private uploads) ---
    app.use(privateFiles.router);
    app.use('/uploads', (req, res, next) => {
        if (!IMAGE_EXT.test(req.path)) return res.status(404).end();   // uploads folder only serves raster images
        res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
        next();
    }, sec.staticGuard, express.static(path.join(__dirname, 'uploads'), { dotfiles: 'deny', index: false, maxAge: '7d' }));
    app.use(sec.staticGuard, express.static(path.join(__dirname, './'), {
        dotfiles: 'deny', index: false, maxAge: '1h',
        setHeaders: (res, filePath) => { if (/\.html?$/i.test(filePath)) res.setHeader('Cache-Control', 'no-cache'); },
    }));

    // --- API pipeline ---
    app.use('/api', cors(sec.corsOptionsDelegate()));
    app.use('/api', express.json({ limit: process.env.JSON_LIMIT || '1mb' }));
    app.use('/api', sec.rejectOperatorInjection);

    // Fail fast with a clear 503 (instead of hanging) while MongoDB is unreachable
    app.use('/api', (req, res, next) => {
        if (mongoose.connection.readyState === 1 || process.env.SKIP_DB_GUARD === '1') return next();
        res.setHeader('Retry-After', '5');
        res.status(503).json({ success: false, message: 'Service temporarily unavailable. Please try again in a moment.' });
    });

    const idOf = (req) => String((req.body && (req.body.agentId || req.body.email)) || '').toLowerCase().trim().slice(0, 120);
    app.use('/api', sec.rateLimiter({ windowMs: 60000, max: Number(process.env.RL_API_PER_MIN) || 600 }));
    const loginIp = sec.rateLimiter({ windowMs: 15 * 60000, max: Number(process.env.RL_LOGIN_PER_IP) || 100, message: 'Too many login attempts. Please wait a few minutes and try again.' });
    const loginId = sec.failureLimiter({ windowMs: 15 * 60000, max: 10, keyFn: (r) => 'id:' + idOf(r), message: 'Too many failed attempts for this account. Please wait 15 minutes or reset your password.' });
    ['/api/auth/admin-agent/login', '/api/auth/customer/login', '/api/auth/seller/login'].forEach(p => app.use(p, loginIp, loginId));
    const resetLimit = sec.rateLimiter({ windowMs: 15 * 60000, max: 8, keyFn: (r) => 'rs:' + idOf(r) + ':' + r.ip, message: 'Too many requests. Please wait a few minutes.' });
    ['/api/auth/forgot-password', '/api/auth/reset-password', '/api/auth/send-form-email-otp', '/api/auth/verify-form-email-otp'].forEach(p => app.use(p, resetLimit));
    // Per-IP allowance is generous because campus Wi-Fi / mobile carriers put many students behind one IP.
    app.use('/api/auth/apply-for-accommodation', sec.rateLimiter({ windowMs: 60000, max: Number(process.env.RL_APPLY_PER_MIN_IP) || 240, message: 'Too many submissions from this network. Please wait a minute and try again.' }));
    app.use('/api/auth/apply-for-accommodation', sec.rateLimiter({ windowMs: 10 * 60000, max: Number(process.env.RL_APPLY_PER_EMAIL) || 8, keyFn: (r) => 'ap:' + String((r.body && r.body.studentEmail) || '').toLowerCase().slice(0, 120), message: 'Too many submissions for this email address. Please wait a few minutes.' }));

    app.use('/api/auth', authRoutes);
    app.use('/api/admin', adminRoutes);
    app.use('/api/seller', sellerRoutes);
    app.use('/api/seller/orders', sellerOrderRoutes);
    app.use('/api/shop', shopRoutes);
    app.use('/api/orders', orderRoutes);
    app.use('/api/assistance', assistanceRoutes);
    app.use('/api/agent', agentRoutes);

    app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

    // --- 404 + centralized error handler ---
    app.use('/api', (req, res) => res.status(404).json({ success: false, message: 'Not found.' }));
    // eslint-disable-next-line no-unused-vars
    app.use((err, req, res, next) => {
        let status = err.status || err.statusCode || 500;
        let message = 'Server error. Please try again.';
        if (err.type === 'entity.too.large') { status = 413; message = 'Request is too large.'; }
        else if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) { status = 400; message = 'Malformed request.'; }
        else if (err.name === 'MulterError' || err.code === 'UNSUPPORTED_FILE') { status = 400; message = err.code === 'UNSUPPORTED_FILE' ? 'Unsupported file type.' : 'Upload rejected: ' + err.message; }
        else if (err.name === 'ValidationError') { status = 400; message = 'Some details are invalid. Please check the form and try again.'; }
        else if (err.name === 'CastError') { status = 400; message = 'Invalid identifier.'; }
        else if (status < 500) message = err.expose ? err.message : 'Bad request.';
        if (status >= 500) logger.error('unhandled route error', { reqId: req.id, method: req.method, path: req.path, ...logger.errMeta(err) });
        if (res.headersSent) return next(err);
        res.status(status).json({ success: false, message, requestId: req.id });
    });
    return app;
}

// ---------------- scheduled job (safe to run on several instances: the update is idempotent) ----------------
let cronTask = null;
function startJobs() {
    if (String(process.env.ENABLE_CRON || 'true') === 'false') return;
    const cron = require('node-cron');
    const Seller = require('./models/Seller');
    cronTask = cron.schedule('0 0 * * *', async () => {
        try {
            const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
            // Single conditional update: a second instance running the same job matches nothing.
            const r = await Seller.updateMany(
                { lastActive: { $lt: sixtyDaysAgo }, status: 'active' },
                { status: 'locked', deactivationReason: 'Automatic lock due to 60 days of inactivity.', reactivationFeeOwed: 150 }
            );
            logger.info('inactive-seller auto-lock finished', { locked: r.modifiedCount });
        } catch (err) {
            logger.error('auto-lock task failed', logger.errMeta(err));
        }
    });
}

let server;
async function startServer() {
    if (!process.env.JWT_SECRET) { logger.error('JWT_SECRET is not set - refusing to start'); process.exit(1); }
    if (process.env.JWT_SECRET.length < 32) logger.warn('JWT_SECRET is shorter than 32 characters - rotate it to a long random value');
    const app = createApp();
    server = app.listen(PORT, () => logger.info('campus collective listening', { port: PORT }));
    // Azure's load balancer keeps idle connections ~230s; Node's 5s default causes random 502/ECONNRESET.
    server.keepAliveTimeout = 65000;
    server.headersTimeout = 66000;
    server.requestTimeout = 120000;
    try {
        await connectDB();
        startJobs();
    } catch (err) {
        logger.error('startup failed: could not connect to MongoDB', logger.errMeta(err));
        process.exit(1);   // non-zero exit lets Azure restart the instance and surfaces the failure in monitoring
    }
}

let shuttingDown = false;
async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info('shutting down', { signal });
    const force = setTimeout(() => { logger.error('forced exit after timeout'); process.exit(1); }, 10000);
    force.unref();
    try {
        if (cronTask) cronTask.stop();
        if (server) await new Promise(r => server.close(r));
        await connectDB.disconnect();
    } catch (err) { logger.error('error during shutdown', logger.errMeta(err)); }
    process.exit(0);
}

if (require.main === module) {
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('unhandledRejection', (reason) => logger.error('unhandled promise rejection', logger.errMeta(reason instanceof Error ? reason : new Error(String(reason)))));
    process.on('uncaughtException', (err) => { logger.error('uncaught exception', logger.errMeta(err)); shutdown('uncaughtException'); });
    startServer();
}

module.exports = { createApp };
