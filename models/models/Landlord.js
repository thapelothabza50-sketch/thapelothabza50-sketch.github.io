const mongoose = require('mongoose');

const LandlordSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    propertyAddress: { type: String, required: true },
    institution: { type: String, required: true }, // New Field
    nsfasAccredited: { type: String, required: true }, // New Field (Yes/No)
    status: { type: String, default: 'Pending' }, // For Management Tracking
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Landlord', LandlordSchema);