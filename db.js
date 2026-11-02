// db.js - MongoDB connection with sane pool/timeouts, event logging and bounded start-up retries.
require('dotenv').config();
const mongoose = require('mongoose');
const logger = require('./lib/logger');

const num = (v, d) => (Number.isFinite(parseInt(v, 10)) ? parseInt(v, 10) : d);

function connectionOptions() {
    return {
        // Pool is per server instance. Total = instances x maxPoolSize must stay below the cluster's connection limit
        // (Atlas M0 = 500). 20 comfortably serves 1,000 concurrent applicants because each request holds a connection
        // for only a few milliseconds. Tune with MONGO_MAX_POOL_SIZE after measuring.
        maxPoolSize: num(process.env.MONGO_MAX_POOL_SIZE, 20),
        minPoolSize: num(process.env.MONGO_MIN_POOL_SIZE, 2),
        maxIdleTimeMS: 60000,
        serverSelectionTimeoutMS: num(process.env.MONGO_SERVER_SELECTION_MS, 8000),
        connectTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        bufferTimeoutMS: 5000,       // fail fast instead of hanging requests when the DB is unreachable
        heartbeatFrequencyMS: 10000,
    };
}

let listenersAttached = false;
function attachListeners() {
    if (listenersAttached) return;
    listenersAttached = true;
    const c = mongoose.connection;
    c.on('connected', () => logger.info('mongodb connected'));
    c.on('disconnected', () => logger.warn('mongodb disconnected (driver will keep trying to reconnect)'));
    c.on('reconnected', () => logger.info('mongodb reconnected'));
    c.on('error', (err) => logger.error('mongodb connection error', logger.errMeta(err)));
}

const isReady = () => mongoose.connection.readyState === 1;

async function ping(timeoutMs = 2000) {
    if (!isReady()) return false;
    try {
        await Promise.race([
            mongoose.connection.db.admin().ping(),
            new Promise((_, rej) => setTimeout(() => rej(new Error('ping timeout')), timeoutMs)),
        ]);
        return true;
    } catch (_) { return false; }
}

const connectDB = async () => {
    const dbURI = process.env.MONGODB_URI;
    if (!dbURI) throw new Error('MONGODB_URI is not defined');
    attachListeners();
    const attempts = num(process.env.MONGO_CONNECT_ATTEMPTS, 4);
    let lastErr;
    for (let i = 1; i <= attempts; i++) {
        try {
            await mongoose.connect(dbURI, connectionOptions());
            logger.info('mongodb connection successful', { db: mongoose.connection.name });
            return;
        } catch (err) {
            lastErr = err;
            logger.error(`mongodb connection attempt ${i}/${attempts} failed`, logger.errMeta(err));
            if (i < attempts) await new Promise(r => setTimeout(r, 1500 * i));
        }
    }
    throw lastErr; // caller decides (server.js exits non-zero so Azure restarts the instance)
};

module.exports = connectDB;
module.exports.isReady = isReady;
module.exports.ping = ping;
module.exports.disconnect = () => mongoose.connection.close(false);
