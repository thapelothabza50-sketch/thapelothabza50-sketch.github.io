'use strict';
// Shared multer limits/filters. Extension AND mimetype must agree; SVG/HTML/script uploads are never accepted.
const path = require('path');
const IMAGE = { exts: ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'], mimes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'] };
const DOC = {
    exts: [...IMAGE.exts, '.pdf', '.doc', '.docx'],
    mimes: [...IMAGE.mimes, 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/octet-stream'],
};

function fileFilter(kind) {
    const rule = kind === 'image' ? IMAGE : DOC;
    return (req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase();
        if (!rule.exts.includes(ext) || !rule.mimes.includes(String(file.mimetype).toLowerCase())) {
            const err = new Error('Unsupported file type.');
            err.status = 400; err.code = 'UNSUPPORTED_FILE';
            return cb(err);
        }
        cb(null, true);
    };
}
const limits = (mb = 8, files = 12) => ({ fileSize: mb * 1024 * 1024, files, fields: 60, parts: 80 });

module.exports = { fileFilter, limits };
