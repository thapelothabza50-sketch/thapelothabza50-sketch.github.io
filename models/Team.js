const mongoose = require('mongoose');

const TeamSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    headAgent: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Agent',
        required: true
    },
    description: { type: String, default: '', trim: true },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

TeamSchema.index({ name: 1 });
TeamSchema.index({ headAgent: 1 });

module.exports = mongoose.model('Team', TeamSchema);
