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

    // Residential Address
    resStreet: String,
    resSuburb: String,
    resCity: String,
    resProvince: String,
    resCode: String,

    // Next of Kin
    nokName: String,
    nokSurname: String,
    nokRelationship: String,
    nokPhone: String,
    nokEmail: String,

    // Academic & Qualifications
    highSchool: String,
    highestGrade: String,
    inMatric: String,
    qual1: String,
    qual2: String,
    qual3: String,
    qual4: String,
    selectedUniversities: [String],
    selectedColleges: [String],
    promiseId: { type: Boolean, default: false },
    promiseAcademic: { type: Boolean, default: false },
    
    // Document upload paths
    fileIdPath: String,
    fileAcademicPath: String,

    // Status for Tracker
    status: { type: String, default: 'Pending' },
    submittedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Assistance', AssistanceSchema);