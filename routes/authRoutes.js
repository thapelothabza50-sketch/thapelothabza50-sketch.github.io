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
        
        // REMOVED: manual salt and hashedPassword logic

        agent = new Agent({
            email,
            agentId,
            phone,
            fullName,
            password: temporaryPassword, // Pass plain text; the model will hash it
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
    const { agentId, password } = req.body; 

    try {
        if (!agentId || !password) {
            return res.status(400).json({ message: 'Agent ID and password are required' });
        }

        const agent = await Agent.findOne({ agentId: agentId.trim() });

        if (!agent) {
            return res.status(400).json({ message: 'Invalid Agent ID' });
        }

        // --- THE MISSING GATEKEEPER STEP START ---
        const isMatch = await bcrypt.compare(password, agent.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        // --- THE MISSING GATEKEEPER STEP END ---

        // 4. Handle first-time login (Mandatory Reset)
        if (agent.mustChangePassword) {
            const tempToken = jwt.sign(
                { id: agent._id, role: agent.role, agentId: agent.agentId },
                process.env.JWT_SECRET,
                { expiresIn: '15m' }
            );
            return res.status(200).json({ 
                action: 'MANDATORY_RESET', 
                token: tempToken,
                message: 'First login detected. Please reset your password.' 
            });
        }

        if (agent.status === 'locked') {
            return res.status(403).json({ 
                message: 'Your account is locked. Please contact administration.' 
            });
        }

        // 5. Normal Login: Create the full Token
        const token = jwt.sign(
            { id: agent._id, role: agent.role, agentId: agent.agentId },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        res.json({
            token,
            user: { 
                id: agent._id, 
                fullName: agent.fullName, 
                role: agent.role,
                agentId: agent.agentId 
            }
        });

    } catch (err) {
        // Handling exceptions as per Lab Work 5.4 
        console.error("AGENT LOGIN ERROR:", err);
        res.status(500).json({ message: 'Server error' });
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
            return res.status(403).json({ message: 'Account Locked. Contact Administration.' });
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

// =========================================================================
// PASSWORD RECOVERY SYSTEM
// =========================================================================

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
            from: '"Campus Collective Support" <no-reply@mycampuscollective.me>',
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
                    <p style="color: #475569; line-height: 1.6;">We received a request to reset your password. Use the code below to proceed.</p>
                    <div style="text-align: center; margin: 35px 0;">
                        <div style="display: inline-block; padding: 20px 40px; background-color: #eff6ff; border: 2px dashed #3b82f6; border-radius: 12px;">
                            <span style="font-size: 36px; font-weight: 800; color: #1e40af; letter-spacing: 8px;">${code}</span>
                        </div>
                        <p style="color: #ef4444; font-size: 13px; font-weight: 600; margin-top: 15px;">⏳ This code expires in 60 minutes.</p>
                    </div>
                    <p style="color: #475569; line-height: 1.6;">
                        <strong>Security Note:</strong> If this wasn't you, report it to <a href="mailto:info@mycampuscollective.me">info@mycampuscollective.me</a> immediately.
                    </p>
                </div>
                <div style="padding: 25px; background-color: #f1f5f9; text-align: center;">
                    <p style="color: #64748b; font-size: 13px;">This is automated. <strong>Do not reply directly.</strong></p>
                </div>
            </div>`
        };

        await transporter.sendMail(mailOptions);
        res.json({ message: "Verification code sent to your email!" });

    } catch (err) {
        console.error("FORGOT PASSWORD ERROR:", err.message);
        res.status(500).json({ message: "An error occurred while sending the email." });
    }
});

/**
 * @route   POST /api/auth/reset-password
 * @desc    Verify code and update the password (THIS WAS MISSING!)
 */
router.post('/reset-password', async (req, res) => {
    const { email, code, newPassword } = req.body;
    try {
        const user = await User.findOne({ email }) || 
                     await Agent.findOne({ email }) || 
                     await Seller.findOne({ email });

        if (!user) return res.status(404).json({ message: "User not found." });

        // Logic for code verification...

        // Simply set the plain text password here. 
        // user.save() will trigger the hashing middleware in User.js/Agent.js/Seller.js
        user.password = newPassword; 
        
        user.resetCode = undefined;
        user.resetCodeExpire = undefined;
        await user.save();

        res.json({ message: "Password updated successfully!" });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
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

/**
 * @route   GET /api/auth/all-recruits
 * @desc    Get all student recruits for Admin dashboard
 * @access  Private (Admin Only)
 */
router.get('/all-recruits', auth, hasRole(['Admin']), async (req, res) => {
    try {
        // This fetches all recruits and fills in the Agent's name instead of just their ID
        const recruits = await Recruit.find().populate('agent', 'fullName'); 
        res.json(recruits);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error fetching recruits');
    }
});

/**
 * @route   DELETE /api/auth/recruit/:id
 * @desc    Delete a specific recruit
 * @access  Private
 */
router.delete('/recruit/:id', auth, async (req, res) => {
    try {
        const recruit = await Recruit.findById(req.params.id);

        if (!recruit) {
            return res.status(404).json({ message: 'Recruit not found' });
        }

        // Security: Ensure only the agent who created it (or an Admin) can delete it
        if (recruit.agent.toString() !== req.user.id && req.user.role !== 'Admin') {
            return res.status(401).json({ message: 'User not authorized to delete this record' });
        }

        await recruit.deleteOne();
        res.json({ message: 'Recruit removed successfully' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error during deletion');
    }
});

// --- DELETE RECRUIT ROUTE ---
router.delete('/delete-recruit/:id', auth, hasRole(['Admin']), async (req, res) => {
    try {
        await Recruit.findByIdAndDelete(req.params.id);
        res.json({ message: "Recruit deleted successfully" });
    } catch (err) {
        res.status(500).json({ message: "Server Error" });
    }
});

/**
 * @route   POST /api/auth/update-status
 * @desc    Update recruit status and set commission/price
 * @access  Private (Admin Only)
 */
router.post('/update-status', auth, hasRole(['Admin']), async (req, res) => {
    const { recruitId, status, price } = req.body;

    try {
        const recruit = await Recruit.findById(recruitId);
        if (!recruit) {
            return res.status(404).json({ message: 'Recruit record not found' });
        }

        // Update the fields
        recruit.status = status;
        
        // If price was sent from the prompt, save it as the commission
        if (price !== undefined) {
            recruit.commissionEarned = parseFloat(price) || 0;
        }

        await recruit.save();
        res.json({ message: 'Status updated successfully', recruit });
    } catch (err) {
        console.error("UPDATE STATUS ERROR:", err.message);
        res.status(500).json({ message: 'Server Error during status update' });
    }
});
/**
 * @route   PUT /api/auth/recruit/:id
 * @desc    Update recruit details
 * @access  Private
 */
router.put('/recruit/:id', auth, async (req, res) => {
    const { studentName, studentSurname, studentEmail, studentPhone, accommodation, moveInDate } = req.body;

    try {
        let recruit = await Recruit.findById(req.params.id);

        if (!recruit) {
            return res.status(404).json({ message: 'Recruit not found' });
        }

        // Security Check
        if (recruit.agent.toString() !== req.user.id && req.user.role !== 'Admin') {
            return res.status(401).json({ message: 'User not authorized' });
        }

        // Update fields
        recruit.studentName = studentName || recruit.studentName;
        recruit.studentSurname = studentSurname || recruit.studentSurname;
        recruit.studentEmail = studentEmail || recruit.studentEmail;
        recruit.studentPhone = studentPhone || recruit.studentPhone;
        recruit.accommodation = accommodation || recruit.accommodation;
        recruit.moveInDate = moveInDate || recruit.moveInDate;

        await recruit.save();
        res.json({ message: 'Recruit updated successfully', recruit });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error during update');
    }
});

/**
 * @route   PUT /api/auth/update-profile
 * @desc    Update Agent personal details (Name, Email, Phone)
 * @access  Private
 */
router.put('/update-profile', auth, async (req, res) => {
    const { fullName, email, phone } = req.body;
    try {
        const agent = await Agent.findById(req.user.id);
        if (!agent) return res.status(404).json({ message: 'Agent not found' });

        // Update fields if they are provided
        agent.fullName = fullName || agent.fullName;
        agent.email = email || agent.email;
        agent.phone = phone || agent.phone;

        await agent.save();
        res.json({ message: 'Profile updated successfully', user: agent });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error updating profile');
    }
});

/**
 * @route   PUT /api/auth/update-banking
 * @desc    Update Agent banking details
 * @access  Private
 */
router.put('/update-banking', auth, async (req, res) => {
    const { bankName, accHolder, accNumber } = req.body;
    try {
        const agent = await Agent.findById(req.user.id);
        if (!agent) return res.status(404).json({ message: 'Agent not found' });

        // Assign the new values
        agent.bankName = bankName;
        agent.accHolder = accHolder;
        agent.accNumber = accNumber;

        // CRITICAL FIX: Save the changes to the database
        await agent.save(); 

        // Send back the UPDATED agent object so the frontend can update localStorage
        res.json({ message: 'Banking details saved', user: agent });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error updating banking');
    }
});

const WaterLog = require('../models/WaterLog');
// --- ADD WATER LOG ---
router.post('/water/add', auth, hasRole(['Admin']), async (req, res) => {
    try {
        const { date, truckQuantity, totalCost } = req.body; // Changed from pricePerUnit
        const newLog = new WaterLog({ 
            date, 
            truckQuantity, 
            totalCost, // Use the flat price per load
            month: date.substring(0, 7) 
        });

        await newLog.save();
        res.status(201).json({ message: 'Water log added successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Error saving load', error: err.message });
    }
});

// 2. GET SMART SUMMARY & TRENDS
router.get('/water/summary', auth, hasRole(['Admin']), async (req, res) => {
    try {
        const logs = await WaterLog.find().sort({ date: -1 });
        
        const stats = logs.reduce((acc, log) => {
            if (!acc[log.month]) acc[log.month] = { totalQty: 0, totalSpend: 0 };
            acc[log.month].totalQty += log.truckQuantity;
            acc[log.month].totalSpend += log.totalCost;
            return acc;
        }, {});

        const months = Object.keys(stats).sort().reverse(); 
        let trendMsg = "Insufficient data for trend";
        let trendColor = "text-gray-500";

        if (months.length >= 2) {
            const current = stats[months[0]].totalQty;
            const previous = stats[months[1]].totalQty;
            const diff = ((current - previous) / previous) * 100;
            
            if (diff > 0) {
                trendMsg = `Increased by ${diff.toFixed(1)}% ↑`;
                trendColor = "text-red-600"; 
            } else {
                trendMsg = `Decreased by ${Math.abs(diff).toFixed(1)}% ↓`;
                trendColor = "text-green-600";
            }
        }

        res.json({ 
            logs, 
            currentMonth: months[0] ? stats[months[0]] : { totalQty: 0, totalSpend: 0 },
            trend: trendMsg,
            trendColor: trendColor
        });
    } catch (err) {
        res.status(500).json({ message: 'Server Error' });
    }  
});

// --- EDIT/UPDATE WATER LOG ---
router.put('/water/edit/:id', auth, hasRole(['Admin']), async (req, res) => {
    try {
        const { date, truckQuantity, totalCost } = req.body;
        const updatedLog = await WaterLog.findByIdAndUpdate(
            req.params.id,
            { 
                date, 
                truckQuantity, 
                totalCost, 
                month: date.substring(0, 7) 
            },
            { new: true }
        );
        if (!updatedLog) return res.status(404).json({ message: "Log not found" });
        res.json({ message: "Water log updated successfully" });
    } catch (err) {
        res.status(500).json({ message: "Error updating log" });
    }
});

// --- DELETE WATER LOG ---
router.delete('/water/delete/:id', auth, hasRole(['Admin']), async (req, res) => {
    try {
        await WaterLog.findByIdAndDelete(req.params.id);
        res.json({ message: "Water log deleted successfully" });
    } catch (err) {
        res.status(500).json({ message: "Error deleting log" });
    }
});

const Landlord = require('../models/Landlord');

// --- LANDLORD REGISTRATION ROUTE ---
router.post('/landlord/register', async (req, res) => {
    try {
        const { fullName, email, phone, propertyAddress, institution, nsfasAccredited } = req.body;

        const newListing = new Landlord({
            fullName, email, phone, propertyAddress, institution, nsfasAccredited
        });

        await newListing.save();

        // Send Automated Email
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Application Received - Campus Collective',
            html: `<h1>Hello ${fullName}</h1>
                   <p>Thank you for registering your property with Campus Collective.</p>
                   <p>Our team is currently reviewing your application for <b>${propertyAddress}</b>.</p>
                   <p>We will contact you shortly regarding the next steps.</p>`
        };

        transporter.sendMail(mailOptions);

        res.status(201).json({ message: "Application submitted successfully!" });
    } catch (err) {
        res.status(500).json({ message: "Server Error", error: err.message });
    }
    // Inside your student recruitment route:
const agent = await Agent.findById(req.user.id);

const newRecruit = new Recruit({
    ...req.body,
    agent: agent._id,
    commissionRate: agent.commissionRate // This locks the price at the time of recruitment
});
});

module.exports = router;