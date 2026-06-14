const mongoose = require('mongoose');

const UploadSchema = new mongoose.Schema({
  originalName: {
    type: String,
    required: true,
    trim: true,
  },
  fileName: {
    type: String,
    required: true,
    trim: true,
  },
  url: {
    type: String,
    required: true,
    trim: true,
  },
  category: {
    type: String,
    enum: ['VUT Report', 'Contract', 'Other'],
    default: 'Other',
    trim: true,
  },
  institution: {
    type: String,
    enum: ['UMP', 'TUT', 'VUT', 'Other'],
    default: 'Other',
    trim: true,
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agent',
    required: true,
  },
  uploadedByName: {
    type: String,
    required: true,
    trim: true,
  },
  uploadedByRole: {
    type: String,
    enum: ['Admin', 'RestrictedAdmin', 'Agent'],
    default: 'Agent',
    trim: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Upload', UploadSchema);
