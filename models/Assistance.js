const mongoose = require('mongoose');

const AssistanceSchema = new mongoose.Schema({
    // Personal Identity
    title: String,
    firstNames: { type: String, required: true },
    surname: { type: String, required: true },
    idNumber: { type: String, required: true },
    gender: String,
    maritalStatus: String,
    race: String,
    disability: String,
    disabilityDetails: String,
    isFirstTimeApplicant: String,
    returningStudentDetails: String,
    phone: String,
    email: String,

    // Next of Kin
    nokName: String,
    nokSurname: String,
    nokRelationship: String,
    nokPhone: String,
    nokEmail: String,

    // Status for Tracker
    status: { type: String, default: 'Pending' },
    submittedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Assistance', AssistanceSchema);