const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

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
    role: {
        type: String,
        default: 'Agent',
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

// --- MIDDLEWARE: HASH PASSWORD BEFORE SAVING ---
// This ensures that whenever a password is set or changed, it is hashed once.
AgentSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (err) {
        next(err);
    }
});

// --- HELPER: COMPARE PASSWORD ---
// This is used in authRoutes.js to check if the typed password is correct.
AgentSchema.methods.comparePassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('Agent', AgentSchema);