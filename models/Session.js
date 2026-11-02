const mongoose = require('mongoose');

// Server-side record for every issued JWT. A token is only valid while its Session is active.
const SessionSchema = new mongoose.Schema({
    jti: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    kind: { type: String, enum: ['Agent', 'User', 'Seller'], required: true },
    role: { type: String, required: true },
    scope: { type: String, enum: ['full', 'reset'], default: 'full' },
    revokedAt: { type: Date, default: null },
    revokedReason: { type: String },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true }
});

SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });     // MongoDB removes expired sessions
SessionSchema.index({ userId: 1, kind: 1, revokedAt: 1 });             // single-session revocation lookup

module.exports = mongoose.model('Session', SessionSchema);
