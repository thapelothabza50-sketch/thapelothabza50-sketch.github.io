'use strict';
const nodemailer = require('nodemailer');
const logger = require('./logger');

let transporter;
function getTransporter() {
    if (!transporter) {
        transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: Number(process.env.EMAIL_PORT) || 465,
            secure: String(process.env.EMAIL_SECURE || 'true') !== 'false',
            auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
            // TLS verification is ON unless explicitly disabled by env (it used to be hard-disabled).
            tls: { rejectUnauthorized: String(process.env.EMAIL_TLS_REJECT_UNAUTHORIZED || 'true') !== 'false' },
            connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000,
            pool: true, maxConnections: 3, maxMessages: 100,
        });
    }
    return transporter;
}

// Awaitable send (for flows where the e-mail IS the product: OTP, reset codes).
function sendMail(opts) { return getTransporter().sendMail(opts); }

// Fire-and-forget send (for notifications that must never fail a saved record).
function sendMailBackground(opts, label = 'mail') {
    setImmediate(() => {
        getTransporter().sendMail(opts).catch(err => logger.warn(`${label} failed`, logger.errMeta(err)));
    });
}

module.exports = { sendMail, sendMailBackground, _setTransporter: (t) => { transporter = t; } };
