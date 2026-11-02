// middleware/auth.js
// Verifies the JWT signature AND that its server-side session is active AND that the account is still allowed in.
const { verifyToken, isSessionActive, kindFor, revokeSession } = require('../lib/session');
const logger = require('../lib/logger');
const Agent = require('../models/Agent');
const Seller = require('../models/Seller');
const User = require('../models/User');

const MODELS = { Agent, Seller, User };

function extractToken(req) {
    const h = req.header('Authorization');
    if (!h) return null;
    const m = /^Bearer\s+(\S+)$/i.exec(h.trim());
    return m ? m[1] : null;
}

function build({ allowReset }) {
    return async function authMiddleware(req, res, next) {
        const token = extractToken(req);
        if (!token) return res.status(401).json({ message: 'No token, authorization denied.' });

        let decoded;
        try {
            decoded = verifyToken(token);
        } catch (err) {
            return res.status(401).json({ message: 'Token is not valid or has expired.' });
        }
        if (!decoded || !decoded.id || !decoded.role || !decoded.jti) {
            return res.status(401).json({ message: 'Token is not valid or has expired.' });
        }
        if (decoded.scope === 'reset' && !allowReset) {
            return res.status(403).json({ message: 'Please complete your password setup first.' });
        }

        try {
            if (!(await isSessionActive(decoded.jti))) {
                return res.status(401).json({ message: 'Session has ended. Please log in again.' });
            }
            const kind = kindFor(decoded.role);
            const account = await MODELS[kind].findById(decoded.id).select('role status isDeleted').lean();
            if (!account || account.isDeleted) {
                return res.status(401).json({ message: 'Account no longer exists.' });
            }
            if (account.status === 'locked') {
                await revokeSession(decoded.jti, 'account_locked').catch(() => {});
                return res.status(403).json({ message: 'Your account is locked. Please contact administration.' });
            }
            // Role always comes from the database, so demotions/promotions apply immediately.
            req.user = { ...decoded, role: account.role || decoded.role };
            next();
        } catch (err) {
            logger.error('auth check failed', { reqId: req.id, ...logger.errMeta(err) });
            res.status(503).json({ message: 'Authentication is temporarily unavailable. Please retry.' });
        }
    };
}

const auth = build({ allowReset: false });
const authAllowReset = build({ allowReset: true });

function hasRole(requiredRoles) {
    const lowerRequiredRoles = requiredRoles.map(role => role.toLowerCase());
    return (req, res, next) => {
        if (!req.user || !req.user.role) {
            return res.status(403).json({ message: 'Access denied. User role could not be verified.' });
        }
        if (lowerRequiredRoles.includes(String(req.user.role).toLowerCase())) return next();
        return res.status(403).json({ message: 'Access denied. Insufficient privileges.' });
    };
}

module.exports = { auth, authAllowReset, hasRole };
