// models/User.js (FIXED & UPDATED)
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

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
    dateJoined: {
        type: Date,
        default: Date.now
    }
});

// Middleware to hash password before saving
UserSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

UserSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);