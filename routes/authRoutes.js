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
const path = require('path');
require('dotenv').config();

const { auth, hasRole } = require('../middleware/auth'); 
const multer = require('multer');
const fs = require('fs');



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

const loginUrl = "https://www.mycampuscollective.me/agent%20login.html"; // Replace with your real URL

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
            <p>We are thrilled to welcome you to the team. Your agent account is now active and ready for use. Please check the attached document about the roles of a campus collective agent.
             Below are your official login details to access the agent portal.</p>
            
            <div style="background-color: #f4f7f9; padding: 20px; border-radius: 6px; margin: 25px 0; border-left: 5px solid #3498db;">
                <p style="margin: 0; font-weight: bold; color: #2c3e50;">Access Credentials:</p>
                <p style="margin: 10px 0 5px 0;"><strong>Agent ID:</strong> ${agentId}</p>
                <p style="margin: 0;"><strong>Temporary Password:</strong> <span style="color: #e74c3c; font-family: monospace; font-size: 1.1em;">${temporaryPassword}</span></p>
            </div>

            <p style="text-align: center; margin: 30px 0;">
                <a href="${loginUrl}" style="background-color: #3498db; color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">Login to Your Portal</a>
            </p>

            <p style="font-size: 0.9em; color: #666; font-style: italic;"><strong>Security Note:</strong> You will be prompted to create a new permanent password upon your first login for security purposes.</p>
            <p>If you have any questions or need assistance, feel free to reach out to our support team at <a href="mailto:info@mycampuscollective.me">info@mycampuscollective.me</a></p>
            <hr style="border: 0; border-top: 1px solid #eeeeee; margin: 25px 0;">
            
            <p style="margin: 0; font-weight: bold; color: #2c3e50;">Regards,</p>
            <p style="margin: 5px 0 0 0; color: #2c3e50;">Campus Collective Management</p>
            
            <p style="font-size: 0.75em; color: #999; text-align: center; margin-top: 30px;">
                &copy; 2026 Campus Collective. All rights reserved.<br>
                This is an automated message, please do not reply directly to this email.
            </p>
        </div>
    `,
    // THIS PART ATTACHES THE LOGO TO THE EMAIL
    // THIS PART ATTACHES THE LOGO AND PDF TO THE EMAIL
    attachments: [
        {
            filename: 'logo.jpg',
            // --- FIXED: Added path.join and corrected the folder jump ---
            path: path.join(__dirname, '../Images/Campus collective logo origin.jpg'), 
            cid: 'campus_logo' 
        },
        {
            filename: 'Campus_Collective_Agent_Guide.pdf',
            // This path is already correct
            path: path.join(__dirname, '../documents/Agent_Guide.pdf')
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

       res.json({ 
            message: 'Profile updated successfully!',
            user: {
                fullName: agent.fullName,
                agentId: agent.agentId
            }
        });
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

// --------------------------------------------------------------------------
// 1. MULTER CONFIGURATION (Fixed: Declared only once)
// --------------------------------------------------------------------------
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); 
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

// --------------------------------------------------------------------------
// 2. THE ANNOUNCEMENT ROUTE (Fixed: Added Agent Loop & Broadcast Logic)
// --------------------------------------------------------------------------
/**
 * @route   POST /api/auth/announce-residence
 * @desc    Broadcasts a residence alert to ALL agents in the database
 * @access  Private (Admin Only)
 */
router.post('/announce-residence', auth, hasRole(['Admin']), upload.single('resImage'), async (req, res) => {
    const { resName, location, rooms, funding, resSlug, mode } = req.body;

    try {
        // If mode is 'draft', we just confirm receipt and don't send emails
        if (mode === 'draft') {
            return res.status(200).json({ message: 'Residence draft saved successfully!' });
        }

        // 1. Fetch all Agents from your database
        const agents = await Agent.find({ role: 'Agent' });
        
        if (!agents || agents.length === 0) {
            return res.status(404).json({ message: 'No agents found to notify.' });
        }

        // Construct the URL Brevo will use to fetch the image
        const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

        // 2. Loop through all agents and send individual emails using the template
        const emailPromises = agents.map(agent => {
            const mailOptions = {
                from: '"Campus Collective Updates" <no-reply@mycampuscollective.me>',
                to: agent.email, // Dynamic email from database
                subject: `New Residence Alert: ${resName}`,
                headers: {
                    'X-Mailin-Template-Id': '1', 
                    'X-Mailin-Parameter': JSON.stringify({
                        "Agent": agent.fullName || "Agent", // Dynamic name from database
                        "RES_NAME": resName,
                        "LOCATION": location,
                        "ROOM_TYPES": rooms,
                        "FUNDING_INFO": funding,
                        "IMAGE_URL_1": imageUrl,
                        "RES_SLUG": resSlug
                    })
                }
            };
            return transporter.sendMail(mailOptions);
        });

        // Wait for all emails to be processed
        await Promise.all(emailPromises);
        
        res.status(200).json({ message: `Announcement broadcasted to ${agents.length} agents!` });

    } catch (err) {
        console.error("ANNOUNCEMENT ERROR:", err.message);
        res.status(500).json({ message: 'Error processing announcement', error: err.message });
    }
});

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Generate a 6-digit code and send a professional HTML email
 */
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;

    try {
        // Find user across all possible models
        const user = await Seller.findOne({ email }) || 
                     await Agent.findOne({ email }) || 
                     await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: "No account found with this email address." });
        }

        // 1. Generate 6-digit verification code
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        
        // 2. Save code to the user document (expires in 1 hour)
        user.resetCode = code;
        user.resetCodeExpire = Date.now() + 3600000; 
        await user.save();

        // 3. Define the professional HTML email
        const mailOptions = {
            from: '"Campus Collective" <no-reply@mycampuscollective.me>',
            to: email,
            subject: "Password Reset Verification Code",
            html: `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #f8fafc;">
                <div style="background-color: #1e40af; padding: 25px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 26px; letter-spacing: 1px;">Campus Collective</h1>
                </div>

                <div style="padding: 40px; background-color: #ffffff;">
                    <h2 style="color: #1e293b; font-size: 20px; margin-top: 0;">Password Reset Request</h2>
                    <p style="color: #475569; line-height: 1.6;">Hello,</p>
                    <p style="color: #475569; line-height: 1.6;">We received a request to reset your password for your Campus Collective account. Please use the verification code below to complete the process.</p>
                    
                    <div style="text-align: center; margin: 35px 0;">
                        <div style="display: inline-block; padding: 20px 40px; background-color: #eff6ff; border: 2px dashed #3b82f6; border-radius: 12px;">
                            <span style="font-size: 36px; font-weight: 800; color: #1e40af; letter-spacing: 8px;">${code}</span>
                        </div>
                        <p style="color: #ef4444; font-size: 13px; font-weight: 600; margin-top: 15px;">
                            ⏳ This code expires in 60 minutes.
                        </p>
                    </div>

                    <p style="color: #475569; line-height: 1.6;">
                        <strong>Security Note:</strong> If you did not request this password reset, please ignore this email or report the incident to <a href="mailto:info@mycampuscollective.me" style="color: #3b82f6; text-decoration: none;">info@mycampuscollective.me</a> immediately.
                    </p>
                </div>

                <div style="padding: 25px; background-color: #f1f5f9; text-align: center; border-top: 1px solid #e2e8f0;">
                    <p style="margin: 0; color: #64748b; font-size: 13px; line-height: 1.5;">
                        This is an automated message. <strong>Please do not reply to this email directly.</strong><br>
                        For any inquiries, please contact us at: 
                        <a href="mailto:info@mycampuscollective.me" style="color: #1e40af; text-decoration: none; font-weight: 600;">info@mycampuscollective.me</a>
                    </p>
                    <p style="margin: 20px 0 0 0; color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">
                        &copy; 2026 Campus Collective. All rights reserved.
                    </p>
                </div>
            </div>
            `
        };

        // 4. Send the email via Nodemailer/Brevo
        await transporter.sendMail(mailOptions);
        res.json({ message: "Verification code sent to your email!" });

    } catch (err) {
        console.error("FORGOT PASSWORD ERROR:", err.message);
        res.status(500).json({ message: "An error occurred while sending the email." });
    }
});
router.post('/submit-recruit', auth, async (req, res) => {
    try {
        console.log("Payload received:", req.body); // Check this in your logs!

        const { 
            studentName, 
            studentSurname, 
            studentEmail, 
            studentPhone, 
            accommodation, 
            moveInDate 
        } = req.body;

        // Validation check before attempting to save to Mongoose
        if (!studentPhone) {
            return res.status(400).json({ message: 'Validation failed', error: 'studentPhone is required' });
        }

        const newRecruit = new Recruit({
            agent: req.user.id,
            agentId: req.user.agentId,
            studentName,
            studentSurname,
            studentEmail,
            studentPhone, 
            accommodation,
            moveInDate,
            status: 'Pending'
        });

        await newRecruit.save();
        res.status(201).json({ message: 'Recruit submitted successfully!' });
    } catch (err) {
        console.error("SUBMIT ERROR:", err.message);
        res.status(500).json({ message: 'Server Error', error: err.message });
    }
});


module.exports = router;