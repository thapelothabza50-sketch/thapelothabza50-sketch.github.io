const mongoose = require('mongoose');

const SignatureSchema = new mongoose.Schema({
    // Changed from ObjectId to String so it accepts any identifier
    ownerId: {
        type: String, 
        required: true
    },
    // We can make this optional or use it as a category (e.g., 'External')
    ownerModel: {
        type: String,
        required: false,
        default: 'External'
    },
    signatureData: {
        type: String, 
        required: true
    },
    purpose: {
        type: String,
        default: 'General Form'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Signature', SignatureSchema);