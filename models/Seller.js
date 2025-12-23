// models/Seller.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const SellerSchema = new mongoose.Schema({
    username: { type: String, required: false, unique: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    firstName: { type: String, required: false, trim: true },
    lastName: { type: String, required: false, trim: true },
    businessName: { type: String, required: false, trim: true },
    phoneNumber: { type: String, required: false, trim: true },
    role: { type: String, default: 'seller' },
    status: { type: String, enum: ['active', 'locked'], default: 'active' },
    
    // 🏆 UPDATES ADDED BELOW
    lastActive: { type: Date, default: Date.now },
    isDeleted: { type: Boolean, default: false },
    reactivationFeeOwed: { type: Number, default: 0 },
    deactivationReason: { type: String },
    
    resetCode: String,      
    resetCodeExpire: Date,  
}, { timestamps: true });

// Your existing password hashing logic
SellerSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

module.exports = mongoose.model('Seller', SellerSchema);