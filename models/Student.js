const mongoose = require('mongoose');

const StudentSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    gender: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    studentNumber: { type: String },
    institution: { type: String, required: true },
    accommodation: { type: String, required: true }, // The residence name
    funding: { type: String, required: true }, // NSFAS, Bursary, or Self-Funded
    bursaryName: { type: String },
    status: { type: String, default: 'Pending' }, // For your dashboard tracking
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Student', StudentSchema);