// routes/authRoutes.js (FULL & UNABRIDGED VERSION)

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs'); 
const jwt = require('jsonwebtoken'); 
const crypto = require('crypto');
const nodemailer = require('nodemailer'); 
const Seller = require('../models/Seller');
const Agent = require('../models/Agent'); 
const User = require('../models/User'); 
const Recruit = require('../models/Recruit'); 
require('dotenv').config();

const { auth, hasRole } = require('../middleware/auth'); 

// --------------------------------------------------------------------------
// NODEMAILER CONFIGURATION 
// --------------------------------------------------------------------------
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT), // Force it to be a number
    secure: Number(process.env.EMAIL_PORT) === 465, 
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
    tls: {
        rejectUnauthorized: false // Helps prevent connection blocks on cloud servers
    },
    connectionTimeout: 10000 // Wait 10 seconds before giving up
});

// =========================================================================
// 1. ADMIN & AGENT MANAGEMENT ROUTES
// =========================================================================

/**
 * @route   POST /api/auth/register-agent
 * @desc    Admin creates a draft Agent account and sends welcome email
 * @access  Private (Admin Only)
 */
router.post('/register-agent', auth, hasRole(['Admin']), async (req, res) => {
    const { email, agentId, phone, fullName } = req.body;

    try {
        let agent = await Agent.findOne({ email });
        if (agent) return res.status(400).json({ message: 'Agent already exists' });

        const temporaryPassword = crypto.randomBytes(4).toString('hex');
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(temporaryPassword, salt);

        agent = new Agent({
            email,
            agentId,
            phone,
            fullName,
            password: hashedPassword,
            mustChangePassword: true
        });

        await agent.save();

        const mailOptions = {
           from: '"Campus Collective" <thapelothabza50@gmail.com>',
            to: email,
            subject: 'Welcome to Campus Collective - Agent Portal Access',
            html: `
                <h1>Welcome, ${fullName}!</h1>
                <p>You have been registered as an official Campus Collective Agent.</p>
                <p><strong>Your Agent ID (Login ID):</strong> ${agentId}</p>
                <p><strong>Temporary Password:</strong> ${temporaryPassword}</p>
                <p>Please log in here: <a href="https://campuscollective.co.za/agent-login.html">Agent Portal</a></p>
                <p><i>You will be required to change your password upon first login.</i></p>
            `
        };

        await transporter.sendMail(mailOptions);
        res.status(201).json({ message: 'Agent registered and email sent successfully.' });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

/**
 * @route   POST /api/auth/admin-agent/login
 * @desc    Login for Admin and Agents using AgentID/StudentID
 */
router.post('/admin-agent/login', async (req, res) => {
    const { loginId, password } = req.body;

    try {
        const agent = await Agent.findOne({ agentId: loginId });
        if (!agent) return res.status(400).json({ message: 'Invalid Credentials' });

        if (agent.status === 'locked') {
            return res.status(403).json({ message: 'Account Locked. Contact Management.' });
        }

        const isMatch = await bcrypt.compare(password, agent.password);
        if (!isMatch) return res.status(400).json({ message: 'Invalid Credentials' });

        const token = jwt.sign(
            { id: agent._id, role: agent.role, email: agent.email },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        if (agent.mustChangePassword) {
            return res.status(200).json({ 
                token, 
                action: 'MANDATORY_RESET', 
                message: 'First login detected. Redirecting to setup.' 
            });
        }

        // --- FIXED RESPONSE FOR DASHBOARD ---
        res.json({ 
            token, 
            role: agent.role, 
            user: { 
                fullName: agent.fullName, 
                agentId: agent.agentId 
            } 
        });

    } catch (err) {
    console.error("LOGIN ERROR DETECTED:", err.message);
    res.status(500).json({ 
        message: 'Internal Server Error', 
        details: err.message 
    });
}
});
/**
 * @route   POST /api/auth/seller/login
 */
router.post('/seller/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await Seller.findOne({ email });
        if (!user) return res.status(400).json({ message: 'Invalid Credentials' });

        const userStatus = user.status || 'active';
        if (userStatus === 'locked') {
            return res.status(403).json({ message: 'Account Locked. Contact Management.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: 'Invalid Credentials' });

        const token = jwt.sign({ id: user._id, role: 'seller' }, process.env.JWT_SECRET, { expiresIn: '7d' });

        res.json({
            token,
            user: { 
                id: user._id, 
                businessName: user.businessName, 
                email: user.email 
            }
        });
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// =========================================================================
// 2. NEW ADDITIONS: COMMISSION & PAYOUT TRACKING
// =========================================================================

/**
 * @route   POST /api/auth/approve-recruit/:id
 * @desc    Approve student and assign commission value
 */
router.post('/approve-recruit/:id', auth, hasRole(['Admin']), async (req, res) => {
    const { commissionAmount } = req.body;
    try {
        const recruit = await Recruit.findById(req.params.id);
        if (!recruit) return res.status(404).json({ message: 'Recruit record not found' });

        recruit.status = 'Approved';
        recruit.commissionEarned = parseFloat(commissionAmount) || 0;
        recruit.isPaid = false; 

        await recruit.save();
        res.json({ message: 'Approval successful', commission: recruit.commissionEarned });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error during approval');
    }
});

/**
 * @route   POST /api/auth/mark-paid
 * @desc    Update records after Paystack success
 */
router.post('/mark-paid', auth, hasRole(['Admin']), async (req, res) => {
    const { agentId, reference } = req.body;
    try {
        // Update all approved recruits for this agent to "Paid"
        const result = await Recruit.updateMany(
            { 
                $or: [{ agentId: agentId }, { agent: agentId }], 
                status: 'Approved', 
                isPaid: false 
            },
            { 
                $set: { 
                    isPaid: true, 
                    paymentReference: reference, 
                    datePaid: Date.now() 
                } 
            }
        );
        res.json({ message: 'Payout records updated', count: result.modifiedCount });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error updating payout records');
    }
});

module.exports = router;