const mongoose = require('mongoose');

const RoomCheckSchema = new mongoose.Schema({
    roomNumber: { type: Number, required: true },
    inspectionDate: { type: String, required: true }, // Format: YYYY-MM-DD
    rating: { type: String, required: true },
    notes: String,
    student1: { name: String, signature: String }, // Base64 Signature
    student2: { name: String, signature: String }, // Base64 Signature
    photos: [String] // Array of photo paths/filenames
}, { timestamps: true });

module.exports = mongoose.model('RoomCheck', RoomCheckSchema);