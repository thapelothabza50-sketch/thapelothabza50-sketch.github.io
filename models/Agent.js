const mongoose = require('mongoose');
const pw = require('../lib/password');

const AgentSchema = new mongoose.Schema({
    agentId: { // Student Number
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    email: { // Student Email
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    password: {
        type: String,
        required: true,
    },
    fullName: {
        type: String,
        default: 'New Agent',
        trim: true,
    },
    phone: {
        type: String,
        required: true,
        trim: true,
    },
    institution: {
        type: String,
        enum: ['UMP', 'TUT', 'VUT', 'Other'],
        default: 'Other',
        trim: true,
    },
    role: {
        type: String,
        enum: ['Admin', 'RestrictedAdmin', 'Agent'],
        default: 'Agent',
    },
    isRestrictedAdmin: {
        type: Boolean,
        default: false,
    },
    // Leadership / team hierarchy used by the admin command centre
    isHeadAgent: {
        type: Boolean,
        default: false,
    },
    headAgent: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Agent',
        default: null,
    },
    team: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Team',
        default: null,
    },
    balance: {
        type: Number,
        default: 0,
    },
    commissionRate: {
    type: Number,
    default: 250, // This ensures every agent has a starting rate
    },
    status: {
        type: String,
        enum: ['active', 'locked'],
        default: 'active',
    },
    mustChangePassword: {
        type: Boolean,
        default: true,
    },
    resetCode: { type: String },
    resetCodeExpire: { type: Date },
    resetAttempts: { type: Number, default: 0 },
    banking: {
        bankName: { type: String, default: '' },
        accHolder: { type: String, default: '' },
        accNumber: { type: String, default: '' },
        bankPhone: { type: String, default: '' }
    },
    lastActive: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

// --- PASSWORD HASHING MIDDLEWARE (Only defined once) ---
AgentSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    try {
        this.password = await pw.hash(this.password);
        next();
    } catch (err) {
        next(err);
    }
});

// --- HELPER: COMPARE PASSWORD ---
AgentSchema.methods.comparePassword = async function (enteredPassword) {
    return await pw.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('Agent', AgentSchema);