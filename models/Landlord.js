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
    photoPaths: [String],
    isSingleRoomFull: { type: Boolean, default: false },
    isSharedRoomFull: { type: Boolean, default: false },
    // Optional hard capacity. null/undefined = unlimited (only the manual "full" switch applies).
    singleRoomsAvailable: { type: Number, default: null, min: 0 },
    sharedRoomsAvailable: { type: Number, default: null, min: 0 },
    status: { type: String, default: 'Pending' },
    createdAt: { type: Date, default: Date.now }
});
LandlordSchema.index({ accommodationName: 1 });

module.exports = mongoose.model('Landlord', LandlordSchema);