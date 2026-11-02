const mongoose = require('mongoose');

const RecruitSchema = new mongoose.Schema({
    agent: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Agent'
    },
    // 🏆 SEASON TRACKING: Links recruit to recruitment season
    season: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Season',
        required: true
    },
    seasonName: {
        type: String,
        // Denormalized for quick filtering (e.g., "First Semester 2026")
    },
    // 🏆 ADDED: This connects the recruit to the Agent's Student Number/Login ID
    agentId: {
        type: String,
        trim: true
    },
    // 🏆 REFERRAL TRACKING: Who referred this recruit
    referencedByName: {
        type: String,
        trim: true,
        default: ''
    },
    referencedByAgentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Agent'
    },
    studentName: {
        type: String,
        required: true,
        trim: true
    },
    studentSurname: {
        type: String,
        required: true,
        trim: true
    },
    studentEmail: {
        type: String,
        required: true,
        lowercase: true
    },
    studentPhone: {
        type: String,
        required: true,
        trim: true
    },
    gender: {
        type: String,
        default: '',
        trim: true
    },
    studentNumber: {
        type: String,
        default: '',
        trim: true
    },
    accommodation: {
        type: String,
        required: true
    },
    institution: {
        type: String,
        enum: ['UMP', 'TUT', 'VUT', 'Other'],
        default: 'Other',
        trim: true
    },
    funding: {
        type: String,
        default: '',
        trim: true
    },
    bursaryName: {
        type: String,
        default: '',
        trim: true
    },
    // Free-text institution exactly as the student typed it (the enum above only holds the normalised value)
    institutionName: { type: String, default: '', trim: true },
    yearOfStudy: { type: String, default: '', trim: true },
    roomType: { type: String, enum: ['', 'Single', 'Sharing'], default: '' },
    nsfasStatus: { type: String, default: '', trim: true },
    // Room reserved for this application (released again if the application is cancelled or removed)
    roomReservation: {
        landlord: { type: mongoose.Schema.Types.ObjectId, ref: 'Landlord' },
        field: { type: String }
    },
    // sha256(email|season|accommodation) - makes repeat submissions (double click / retry) idempotent
    dedupeKey: { type: String },
    moveInDate: {
        type: Date,
        required: true
    },
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Cancelled'],
        default: 'Pending'
    },
    commissionEarned: {
        type: Number,
        default: 0
    },
    // 🏆 ADDED: Tracking for Paystack payments
    isPaid: {
        type: Boolean,
        default: false
    },
    paymentReference: {
        type: String,
        default: ''
    },
    datePaid: {
        type: Date
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    commissionRate: {
    type: Number,
    required: true,
    default: 150
}
});

RecruitSchema.index({ dedupeKey: 1 }, { unique: true, sparse: true });
RecruitSchema.index({ agent: 1, createdAt: -1 });
RecruitSchema.index({ season: 1, status: 1 });
RecruitSchema.index({ studentEmail: 1 });

module.exports = mongoose.model('Recruit', RecruitSchema);