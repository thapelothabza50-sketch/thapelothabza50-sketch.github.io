const mongoose = require('mongoose');

// E-mail verification codes for public forms. Stored in MongoDB (not process memory) so they work across
// multiple server instances and restarts; expired rows are removed automatically.
const FormOtpSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true }
});
FormOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('FormOtp', FormOtpSchema);
