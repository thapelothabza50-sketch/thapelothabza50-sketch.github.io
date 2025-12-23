const mongoose = require('mongoose');

const RecruitSchema = new mongoose.Schema({
    agent: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Agent',
        required: true
    },
    // 🏆 ADDED: This connects the recruit to the Agent's Student Number/Login ID
    agentId: {
        type: String,
        trim: true
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
    accommodation: {
        type: String,
        required: true
    },
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
    }
});

module.exports = mongoose.model('Recruit', RecruitSchema);