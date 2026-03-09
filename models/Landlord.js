const mongoose = require('mongoose');
const LandlordSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    propertyAddress: { type: String, required: true },
    accommodationName: { type: String }, // Added
    institution: { type: String, required: true },
    nsfasAccredited: { type: String, required: true },
    accommodationType: { type: String }, // Added
    rent: { type: Number }, // Added
    status: { type: String, default: 'Pending' },
    createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('Landlord', LandlordSchema);