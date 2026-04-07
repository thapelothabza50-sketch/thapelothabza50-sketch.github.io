const mongoose = require('mongoose');

const SignatureSchema = new mongoose.Schema({
    // The ID of the person signing (Student, Agent, or Landlord)
    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: 'ownerModel' 
    },
    // Tells Mongoose which collection to look in (Student, Agent, etc.)
    ownerModel: {
        type: String,
        required: true,
        enum: ['Student', 'Agent', 'Landlord']
    },
    signatureData: {
        type: String, // Stores the Base64 string
        required: true
    },
    purpose: {
        type: String, // e.g., "Lease Agreement" or "Agent Contract"
        default: 'General Form'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Signature', SignatureSchema);