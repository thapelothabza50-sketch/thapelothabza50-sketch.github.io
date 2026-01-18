// models/Agent.js - UPDATED
const mongoose = require('mongoose');

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
// Add this to the very bottom of models/Agent.js before module.exports
AgentSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    const bcrypt = require('bcryptjs'); // Ensure bcrypt is available
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

module.exports = mongoose.model('Agent', AgentSchema);