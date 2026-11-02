// models/User.js (FIXED & UPDATED)
const mongoose = require('mongoose');
const pw = require('../lib/password');

const UserSchema = new mongoose.Schema({
    firstName: { // Changed from 'name' to 'firstName'
        type: String,
        required: true,
        trim: true
    },
    surname: { // 🏆 NEW FIELD
        type: String,
        required: true,
        trim: true
    },
    phone: { // 🏆 NEW FIELD
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['Customer', 'Seller', 'Admin', 'Agent'],
        default: 'Customer',
        required: true 
    },
    resetCode: { type: String },      // To store the 6-digit code
    resetCodeExpire: { type: Date }, // To make the code expire
    resetAttempts: { type: Number, default: 0 },
    dateJoined: {
        type: Date,
        default: Date.now
    }
});

// Middleware to hash password before saving
UserSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await pw.hash(this.password);
    next();
});

UserSchema.methods.matchPassword = async function (enteredPassword) {
    return await pw.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);