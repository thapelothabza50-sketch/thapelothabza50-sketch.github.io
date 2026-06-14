const mongoose = require('mongoose');

const AccommodationSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        unique: true
    },
    slug: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    description: {
        type: String,
        default: ''
    },
    location: {
        type: String,
        required: true,
        trim: true
    },
    institution: {
        type: String,
        enum: ['UMP', 'TUT', 'VUT', 'Other'],
        default: 'Other',
        required: true,
        trim: true
    },
    images: {
        type: [String],
        default: []
    },
    roomTypes: [{
        type: {
            type: String,
            required: true
        },
        pricePerMonth: {
            type: Number,
            default: 0
        },
        availability: {
            type: Number,
            default: 0
        },
        amenities: [String]
    }],
    amenities: {
        type: [String],
        default: []
    },
    nsfasAccredited: {
        type: Boolean,
        default: false
    },
    contactPhone: {
        type: String,
        default: ''
    },
    contactEmail: {
        type: String,
        default: ''
    },
    landlordId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Landlord',
        default: null
    },
    isActive: {
        type: Boolean,
        default: true
    },
    htmlPageGenerated: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

module.exports = mongoose.model('Accommodation', AccommodationSchema);
