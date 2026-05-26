// models/Season.js
const mongoose = require('mongoose');

const SeasonSchema = new mongoose.Schema({
    // Season identification
    name: {
        type: String,
        required: true,
        trim: true,
        // e.g., "First Semester 2026", "Second Semester 2026"
    },
    semester: {
        type: String,
        enum: ['First', 'Second'],
        required: true
    },
    year: {
        type: Number,
        required: true
    },
    
    // Season timeline
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    
    // Season status
    isActive: {
        type: Boolean,
        default: false,
        // Only ONE season should be active at a time
    },
    status: {
        type: String,
        enum: ['active', 'ended', 'archived'],
        default: 'active'
    },
    
    // Season statistics (for admin dashboard)
    totalRecruits: {
        type: Number,
        default: 0
    },
    approvedRecruits: {
        type: Number,
        default: 0
    },
    pendingRecruits: {
        type: Number,
        default: 0
    },
    cancelledRecruits: {
        type: Number,
        default: 0
    },
    
    // Metadata
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Ensure only one active season at a time
SeasonSchema.pre('save', async function (next) {
    if (this.isActive) {
        // Deactivate all other seasons
        await mongoose.model('Season').updateMany(
            { _id: { $ne: this._id } },
            { isActive: false }
        );
    }
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('Season', SeasonSchema);
