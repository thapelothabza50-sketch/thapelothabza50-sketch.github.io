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
    port: Number(process.env.EMAIL_PORT),
    secure: true, // MUST be true for port 465
    auth: {
        user: process.env.EMAIL_USER, // Ensure this is 9eeab8001@smtp-brevo.com
        pass: process.env.EMAIL_PASS,
    },
    tls: {
        rejectUnauthorized: false // This helps bypass Azure's network restrictions
    },
    connectionTimeout: 10000 // Wait 10 seconds for the greeting
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

       // --- INSIDE THE REGISTRATION ROUTE ---

const loginUrl = "https://your-portal-link.me/login"; // Replace with your real URL

const mailOptions = {
    from: '"Campus Collective" <no-reply@mycampuscollective.me>',
    to: email,
    subject: 'Welcome to the Team! Your Agent Account is Ready',
    html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; padding: 25px; border-radius: 8px;">
            <div style="text-align: center; margin-bottom: 20px;">
                <img src="cid:campus_logo" alt="Campus Collective Logo" style="width: 150px; height: auto;">
            </div>

            <h2 style="color: #2c3e50; text-align: center; margin-top: 0;">Welcome to Campus Collective!</h2>
            <p>Hello <strong>${fullName}</strong>,</p>
            <p>We are thrilled to welcome you to the team. Your agent account is now active and ready for use. Below are your official login details to access the agent portal.</p>
            
            <div style="background-color: #f4f7f9; padding: 20px; border-radius: 6px; margin: 25px 0; border-left: 5px solid #3498db;">
                <p style="margin: 0; font-weight: bold; color: #2c3e50;">Access Credentials:</p>
                <p style="margin: 10px 0 5px 0;"><strong>Agent ID:</strong> ${agentId}</p>
                <p style="margin: 0;"><strong>Temporary Password:</strong> <span style="color: #e74c3c; font-family: monospace; font-size: 1.1em;">${temporaryPassword}</span></p>
            </div>

            <p style="text-align: center; margin: 30px 0;">
                <a href="${loginUrl}" style="background-color: #3498db; color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">Login to Your Portal</a>
            </p>

            <p style="font-size: 0.9em; color: #666; font-style: italic;"><strong>Security Note:</strong> You will be prompted to create a new permanent password upon your first login for security purposes.</p>
            
            <hr style="border: 0; border-top: 1px solid #eeeeee; margin: 25px 0;">
            
            <p style="margin: 0; font-weight: bold; color: #2c3e50;">Regards,</p>
            <p style="margin: 5px 0 0 0; color: #2c3e50;">Campus Collective Management</p>
            
            <p style="font-size: 0.75em; color: #999; text-align: center; margin-top: 30px;">
                &copy; 2026 Campus Collective. All rights reserved.<br>
                This is an automated message, please do not reply directly to this email. For enquiries, email us at <a href="mailto:info@mycampuscollective.me
            </p>
        </div>
    `,
    // THIS PART ATTACHES THE LOGO TO THE EMAIL
    attachments: [
        {
            filename: 'logo.png',
            path: 'Images/Campus collective logo origin.jpg', // CRITICAL: Ensure your logo is in this folder on your server
            cid: 'campus_logo' // This matches the <img src="cid:campus_logo"> above
        }
    ]
};

try {
    // Send the professional email
    await transporter.sendMail(mailOptions);
    return res.status(201).json({ message: 'Agent registered and professional welcome email sent.' });
} catch (emailError) {
    console.error("BREVO EMAIL ERROR:", emailError.message);
    return res.status(201).json({ message: 'Agent registered, but there was an error sending the welcome email.' });

        }

    

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

/**
 * @route   POST /api/auth/complete-agent-setup
 * @desc    Update agent profile and set permanent password on first login
 * @access  Private
 */
router.post('/complete-agent-setup', auth, async (req, res) => {
    const { firstName, surname, password } = req.body;

    try {
        // 1. Find the agent by their ID from the token
        const agent = await Agent.findById(req.user.id);
        if (!agent) return res.status(404).json({ message: 'Agent not found' });

        // 2. Hash the new permanent password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 3. Update the agent's details
        agent.fullName = `${firstName} ${surname}`;
        agent.password = hashedPassword;
        agent.mustChangePassword = false; // This prevents being redirected here again

        await agent.save();

        res.json({ message: 'Profile updated successfully!' });
    } catch (err) {
        console.error("SETUP ERROR:", err.message);
        res.status(500).json({ message: 'Server Error during setup' });
    }
});
router.get('/current-user', auth, async (req, res) => {
    try {
        const agent = await Agent.findById(req.user.id).select('-password');
        res.json(agent);
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

module.exports = router;