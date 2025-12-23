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
    // --- NEW: BANKING DETAILS STRUCTURE ---
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

module.exports = mongoose.model('Agent', AgentSchema);