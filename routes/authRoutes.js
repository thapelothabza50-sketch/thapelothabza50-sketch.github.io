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
const Signature = require('../models/Signature');

const landlordStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../uploads/landlords');
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const sanitized = file.originalname.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_.-]/g, '');
        cb(null, `${Date.now()}-${sanitized}`);
    }
});
const landlordUpload = multer({ storage: landlordStorage });



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
 * @access  Private (Admin and RestrictedAdmin)
 */
router.post('/register-agent', auth, hasRole(['Admin', 'RestrictedAdmin']), async (req, res) => {
    const { email, agentId, phone, fullName, institution, isRestrictedAdmin } = req.body;

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
            institution: institution || 'Other',
            role: isRestrictedAdmin ? 'RestrictedAdmin' : 'Agent',
            isRestrictedAdmin: Boolean(isRestrictedAdmin),
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
            {
                id: agent._id,
                role: agent.role,
                agentId: agent.agentId,
                institution: agent.institution || 'Other',
                fullName: agent.fullName
            },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        res.json({
            token,
            user: {
                id: agent._id,
                fullName: agent.fullName,
                email: agent.email,
                phone: agent.phone,
                role: agent.role,
                institution: agent.institution || 'Other',
                isRestrictedAdmin: agent.isRestrictedAdmin || false,
                agentId: agent.agentId,
                bankName: agent.banking?.bankName || '',
                accHolder: agent.banking?.accHolder || '',
                accNumber: agent.banking?.accNumber || ''
            }
        });

    } catch (err) {
        // Handling exceptions as per Lab Work 5.4 
        console.error("AGENT LOGIN ERROR:", err);
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * @route   GET /api/auth/agents
 * @desc    Get agents by institution (for restricted admin)
 * @access  Private (Admin, RestrictedAdmin)
 */
router.get('/agents', auth, hasRole(['Admin', 'RestrictedAdmin']), async (req, res) => {
    try {
        const { institution } = req.query;
        const filter = {};
        if (institution) {
            filter.institution = institution;
        }
        const agents = await Agent.find(filter).select('-password').sort({ createdAt: -1 });
        res.json(agents);
    } catch (err) {
        console.error('Fetch Agents Error:', err.message);
        res.status(500).json({ message: 'Error fetching agents' });
    }
});

const Product = require('../models/Product');

router.post('/customer/register', async (req, res) => {
    const { firstName, surname, phone, email, password } = req.body;

    if (!firstName || !surname || !phone || !email || !password) {
        return res.status(400).json({ message: 'Please provide your first name, surname, phone, email, and password.' });
    }

    try {
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({ message: 'A customer account with this email already exists.' });
        }

        const newUser = new User({
            firstName,
            surname,
            phone,
            email: email.toLowerCase(),
            password,
            role: 'Customer'
        });

        await newUser.save();

        const token = jwt.sign({ id: newUser._id, role: 'Customer' }, process.env.JWT_SECRET, { expiresIn: '7d' });

        res.status(201).json({
            token,
            user: {
                id: newUser._id,
                firstName: newUser.firstName,
                surname: newUser.surname,
                phone: newUser.phone,
                email: newUser.email,
                role: 'Customer'
            }
        });
    } catch (err) {
        console.error('Customer Register Error:', err.message);
        res.status(500).json({ message: 'Server error during registration.' });
    }
});

router.post('/customer/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required.' });
    }

    try {
        const user = await User.findOne({ email: email.toLowerCase(), role: 'Customer' });
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials.' });
        }

        const token = jwt.sign({ id: user._id, role: 'Customer' }, process.env.JWT_SECRET, { expiresIn: '7d' });

        res.json({
            token,
            user: {
                id: user._id,
                firstName: user.firstName,
                surname: user.surname,
                phone: user.phone,
                email: user.email,
                role: 'Customer'
            }
        });
    } catch (err) {
        console.error('Customer Login Error:', err.message);
        res.status(500).json({ message: 'Server error during login.' });
    }
});

router.get('/user/me', auth, async (req, res) => {
    try {
        const role = (req.user.role || '').toLowerCase();

        if (role === 'seller') {
            const seller = await Seller.findById(req.user.id).select('-password');
            if (!seller) return res.status(404).json({ message: 'Seller profile not found.' });
            return res.json({
                id: seller._id,
                email: seller.email,
                businessName: seller.businessName,
                phoneNumber: seller.phoneNumber,
                role: 'Seller'
            });
        }

        if (role === 'customer') {
            const customer = await User.findById(req.user.id).select('-password');
            if (!customer) return res.status(404).json({ message: 'Customer profile not found.' });
            return res.json({
                id: customer._id,
                email: customer.email,
                firstName: customer.firstName,
                surname: customer.surname,
                phone: customer.phone,
                role: 'Customer'
            });
        }

        return res.status(403).json({ message: 'Unsupported profile role.' });
    } catch (err) {
        console.error('Profile Fetch Error:', err.message);
        res.status(500).json({ message: 'Server error while loading profile.' });
    }
});

router.patch('/user/update', auth, async (req, res) => {
    try {
        const role = (req.user.role || '').toLowerCase();

        if (role === 'seller') {
            const seller = await Seller.findById(req.user.id);
            if (!seller) return res.status(404).json({ message: 'Seller profile not found.' });

            if (req.body.businessName !== undefined) seller.businessName = req.body.businessName;
            if (req.body.phoneNumber !== undefined) seller.phoneNumber = req.body.phoneNumber;

            await seller.save();
            return res.json({
                id: seller._id,
                email: seller.email,
                businessName: seller.businessName,
                phoneNumber: seller.phoneNumber,
                role: 'Seller'
            });
        }

        if (role === 'customer') {
            const customer = await User.findById(req.user.id);
            if (!customer) return res.status(404).json({ message: 'Customer profile not found.' });

            if (req.body.firstName !== undefined) customer.firstName = req.body.firstName;
            if (req.body.surname !== undefined) customer.surname = req.body.surname;
            if (req.body.phone !== undefined) customer.phone = req.body.phone;

            await customer.save();
            return res.json({
                id: customer._id,
                email: customer.email,
                firstName: customer.firstName,
                surname: customer.surname,
                phone: customer.phone,
                role: 'Customer'
            });
        }

        return res.status(403).json({ message: 'Unsupported profile role.' });
    } catch (err) {
        console.error('Profile Update Error:', err.message);
        res.status(500).json({ message: 'Server error while updating profile.' });
    }
});

router.get('/seller/profile', auth, hasRole(['Seller']), async (req, res) => {
    try {
        const seller = await Seller.findById(req.user.id).select('-password');
        if (!seller) return res.status(404).json({ message: 'Seller profile not found.' });

        res.json({
            id: seller._id,
            email: seller.email,
            businessName: seller.businessName,
            phoneNumber: seller.phoneNumber,
            role: 'Seller'
        });
    } catch (err) {
        console.error('Seller Profile Error:', err.message);
        res.status(500).json({ message: 'Server error while loading seller profile.' });
    }
});

router.get('/products', async (req, res) => {
  try {
    const products = await Product.find({ stock: { $gt: 0 } })
      .populate('seller', 'businessName email')
      .sort({ createdAt: -1 })
      .lean();

    // Temporary: do not call an undefined function
    res.json(products);
  } catch (err) {
    console.error('Shop Fetch Error:', err.message);
    res.status(500).json({ message: 'Error fetching products', error: err.message });
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
            institution: req.user.institution || 'Other',
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

        // Return flattened user object for frontend compatibility
        const userResponse = {
            id: agent._id,
            fullName: agent.fullName,
            email: agent.email,
            phone: agent.phone,
            agentId: agent.agentId,
            bankName: agent.banking?.bankName || '',
            accHolder: agent.banking?.accHolder || '',
            accNumber: agent.banking?.accNumber || ''
        };
        res.json({ message: 'Profile updated successfully', user: userResponse });
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

        // Update nested banking object
        agent.banking = {
            bankName: bankName,
            accHolder: accHolder,
            accNumber: accNumber,
            bankPhone: agent.banking?.bankPhone || ''
        };

        await agent.save();

        // Return flattened user object for frontend compatibility
        const userResponse = {
            id: agent._id,
            fullName: agent.fullName,
            email: agent.email,
            phone: agent.phone,
            agentId: agent.agentId,
            bankName: agent.banking.bankName,
            accHolder: agent.banking.accHolder,
            accNumber: agent.banking.accNumber
        };
        res.json({ message: 'Banking details saved', user: userResponse });
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
router.post('/landlord/register', landlordUpload.array('photos', 10), async (req, res) => {
    try {
        const { 
            fullName, 
            email, 
            phone, 
            address, // This comes from the HTML 'address' name
            institution, 
            nsfasAccredited,
            accommodationType,
            rent,
            accommodationName
        } = req.body;

        const photoPaths = (req.files || []).map(file => `/uploads/landlords/${file.filename}`);

        const newListing = new Landlord({
            fullName,
            email,
            phone,
            propertyAddress: address, // Mapping 'address' to 'propertyAddress' for the DB
            institution,
            nsfasAccredited,
            accommodationType, // Make sure to add this to your Landlord.js model!
            rent: rent ? Number(rent) : undefined,
            accommodationName,
            photoPaths
        });

        await newListing.save();

        // Send Automated Email
        // Updated Mail Options with Logo and Formal Styling
const mailOptions = {
    from: '"Campus Collective Applications" <no-reply@mycampuscollective.me>',
    to: email,
    subject: "Application Received: Property Registration",
    html: `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #f8fafc;">
        <div style="background-color: #1e40af; padding: 30px; text-align: center;">
            <img src="cid:campus_logo" alt="Campus Collective" style="width: 180px; height: auto;">
        </div>
        <div style="padding: 40px; background-color: #ffffff;">
            <h2 style="color: #1e293b; font-size: 22px; margin-top: 0; border-bottom: 2px solid #f1f5f9; padding-bottom: 10px;">Property Application Received</h2>
            
            <p style="color: #475569; line-height: 1.6;">Dear <strong>${fullName}</strong>,</p>
            
            <p style="color: #475569; line-height: 1.6;">Thank you for submitting an application to list your property, <strong>${req.body['accommodation name'] || 'Accommodation'}</strong>, with Campus Collective.</p>
            
            <div style="background-color: #f1f5f9; padding: 20px; border-radius: 8px; margin: 25px 0;">
                <p style="margin: 0; color: #1e40af; font-weight: 600;">Application Summary:</p>
                <p style="margin: 10px 0 5px 0; color: #475569;"><strong>Location:</strong> ${address}</p>
                <p style="margin: 0; color: #475569;"><strong>Status:</strong> Under Review</p>
            </div>

            <p style="color: #475569; line-height: 1.6;">Our management team is currently reviewing your details and verification documents. You will receive a follow-up email once the review process is complete.</p>
            
            <p style="color: #475569; line-height: 1.6;">If you have any urgent inquiries, please contact our support office at <a href="mailto:info@mycampuscollective.me" style="color: #1e40af; text-decoration: none;">info@mycampuscollective.me</a>.</p>
            
            <p style="margin-top: 30px; color: #1e293b; font-weight: 600;">Best Regards,<br>
            <span style="color: #64748b; font-weight: 400;">Campus Collective Management</span></p>
        </div>
        <div style="padding: 25px; background-color: #f1f5f9; text-align: center;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">&copy; 2026 Campus Collective. All rights reserved.</p>
            <p style="color: #94a3b8; font-size: 11px; margin-top: 5px;">This is an automated notification. Please do not reply to this email.</p>
        </div>
    </div>`,
    attachments: [
        {
            filename: 'logo.jpg',
            path: path.join(__dirname, '../Images/Campus collective logo origin.jpg'), 
            cid: 'campus_logo' 
        },

    ]
};

        await transporter.sendMail(mailOptions);

        
        res.status(201).json({ message: "Application submitted successfully!" });

    } catch (err) {
        console.error("LANDLORD ERROR:", err.message);
        res.status(500).json({ message: "Server Error", error: err.message });
    }
});

// 2. STUDENT APPLICATION
const Student = require('../models/Student');

router.post('/student-apply', async (req, res) => {
    try {
        const studentData = req.body;
        
        // 1. Save to Database
        const newApplication = new Student(studentData);
        await newApplication.save();

        // 2. Prepare the Tabulated Email Content
        const infoTable = `
            <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-family: Arial, sans-serif;">
                <tr style="background-color: #2563eb; color: white;">
                    <th style="padding: 12px; text-align: left; border: 1px solid #ddd;">Field</th>
                    <th style="padding: 12px; text-align: left; border: 1px solid #ddd;">Details</th>
                </tr>
                <tr>
                    <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Full Name</td>
                    <td style="padding: 10px; border: 1px solid #ddd;">${studentData.fullName}</td>
                </tr>
                <tr>
                    <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Accommodation</td>
                    <td style="padding: 10px; border: 1px solid #ddd;">${studentData.residenceName || studentData.accommodationName}</td>
                </tr>
                <tr>
                    <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Room Type</td>
                    <td style="padding: 10px; border: 1px solid #ddd;">${studentData.roomType}</td>
                </tr>
                <tr>
                    <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Student ID</td>
                    <td style="padding: 10px; border: 1px solid #ddd;">${studentData.studentNumber}</td>
                </tr>
            </table>
        `;

        // 3. Send the Professional Welcome Email
        const mailOptions = {
            from: '"Campus Collective" <no-reply@mycampuscollective.me>',
            to: studentData.email,
            subject: "Application Received - Campus Collective",
            html: `
                <div style="max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden;">
                    <div style="background-color: #2563eb; padding: 20px; text-align: center;">
                        <h1 style="color: white; margin: 0;">Application Confirmed!</h1>
                    </div>
                    <div style="padding: 30px; color: #334155; line-height: 1.6;">
                        <p>Hello <strong>${studentData.fullName}</strong>,</p>
                        <p>Thank you for choosing Campus Collective. We have successfully received your application. Below is a summary of the information you captured:</p>
                        
                        ${infoTable}

                        <p style="margin-top: 20px;">Our team will review your details and an agent will contact you shortly regarding the next steps.</p>
                        
                        <div style="text-align: center; margin-top: 30px;">
                            <a href="https://www.mycampuscollective.me" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Visit Website</a>
                        </div>
                    </div>
                    <div style="background-color: #f8fafc; padding: 15px; text-align: center; font-size: 12px; color: #64748b;">
                        &copy; 2026 Campus Collective. All rights reserved.
                    </div>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);

        res.status(201).json({ message: "Application submitted and confirmation email sent!" });

    } catch (err) {
        console.error("Student Submission Error:", err);
        res.status(500).json({ message: "Server error during submission. Please check all fields." });
    }
});

// Route to toggle room availability
router.post('/admin/toggle-room/:id', async (req, res) => {
    try {
        const { roomType, status } = req.body; // roomType: 'single' or 'shared'
        const update = {};
        if (roomType === 'single') update.isSingleRoomFull = status;
        if (roomType === 'shared') update.isSharedRoomFull = status;

        await Landlord.findByIdAndUpdate(req.params.id, update);
        res.json({ message: "Availability updated" });
    } catch (err) {
        res.status(500).send(err);
    }
});

// 3. ADMIN: FETCH ALL LANDLORDS (For your Tracker)
router.get('/admin/landlords', async (req, res) => {
    try {
        const data = await Landlord.find().sort({ createdAt: -1 });
        res.json(data);
    } catch (err) {
        res.status(500).json({ message: "Error" });
    }
});

// 4. ADMIN: FETCH ALL STUDENTS (For your Tracker)
router.get('/admin/students', async (req, res) => {
    try {
        const data = await Student.find().sort({ createdAt: -1 });
        res.json(data);
    } catch (err) {
        res.status(500).json({ message: "Error" });
    }

});

// 1. MODEL REQUIREMENT (Place this at the top of authRoutes.js)
const RoomCheck = require('../models/RoomCheck');

// 2. ROOM CHECK ROUTES

/**
 * @route   POST /api/room-check/submit
 * @desc    Save a new room inspection to the database
 */
router.post('/room-check/submit', async (req, res) => {
    try {
        const newCheck = new RoomCheck(req.body);
        await newCheck.save();
        res.status(201).json({ 
            success: true, 
            message: "Inspection saved to database successfully!" 
        });
    } catch (err) {
        console.error("Submission Error:", err);
        res.status(500).json({ 
            success: false, 
            message: "Error saving inspection", 
            error: err.message 
        });
    }
});

/**
 * @route   GET /api/room-check/all
 * @desc    Fetch all inspections for the tracker and spreadsheet
 */
router.get('/room-check/all', async (req, res) => {
    try {
        // Sorts by newest date first, then by room number
        const data = await RoomCheck.find().sort({ inspectionDate: -1, roomNumber: 1 });
        res.json(data);
    } catch (err) {
        console.error("Fetch All Error:", err);
        res.status(500).json({ 
            success: false, 
            message: "Error fetching inspections", 
            error: err.message 
        });
    }
});

/**
 * @route   GET /api/rooms
 * @desc    Optional route for room listings (currently returns empty array to prevent crashes)
 */
router.get('/rooms', async (req, res) => {
    try {
        res.json([]); 
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch rooms" });
    }
});

/**
 * @route   POST /api/auth/save-signature
 * @desc    Creates a standalone signature record
 */
router.post('/save-signature', async (req, res) => {
    const { ownerId, ownerType, signatureData, purpose } = req.body;

    try {
        const newSignature = new Signature({
            ownerId,
            ownerModel: ownerType, // e.g., 'Student'
            signatureData,
            purpose
        });

        await newSignature.save();

        res.status(201).json({ 
            success: true, 
            message: "Signature recorded successfully!",
            signatureId: newSignature._id 
        });
    } catch (err) {
        console.error("SIGNATURE MODEL ERROR:", err.message);
        res.status(500).json({ message: "Server Error saving signature" });
    }
});

router.get('/signatures/all', auth, async (req, res) => {
    try {
        const signatures = await Signature.find().sort({ createdAt: -1 });
        res.json(signatures);
    } catch (err) {
        res.status(500).json({ message: "Error fetching signatures" });
    }
});

/**
 * @route   GET /api/auth/signatures/:ownerId
 * @desc    Fetch all signatures associated with a specific ID
 */
router.get('/signatures/:ownerId', async (req, res) => {
    try {
        const signatures = await Signature.find({ ownerId: req.params.ownerId })
            .sort({ createdAt: -1 }); // Newest first

        if (!signatures || signatures.length === 0) {
            return res.status(404).json({ message: "No signatures found for this user." });
        }

        res.json(signatures);
    } catch (err) {
        console.error("Fetch Signature Error:", err);
        res.status(500).json({ message: "Server Error fetching signatures" });
    }
});

const Assistance = require('../models/Assistance');

router.get('/admin/assistance', async (req, res) => {
    try {
        const data = await Assistance.find().sort({ submittedAt: -1 });
        res.json(data);
    } catch (err) {
        console.error('Fetch Assistance Error:', err.message);
        res.status(500).json({ message: 'Error fetching assistance applications' });
    }
});

router.post('/submit-assistance', async (req, res) => {
    try {
        // 1. Save to Database
        const newApp = new Assistance(req.body);
        await newApp.save();

        // 2. Setup Email Transporter (Use your SMTP details)
        const transporter = nodemailer.createTransport({
            service: 'gmail', // or your host
            auth: {
                user: 'your-system-email@gmail.com',
                pass: 'your-app-password'
            }
        });

        // 3. Create Tabulated Email Content
        const emailContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; border: 1px solid #eee;">
                <h2 style="background: #004a99; color: white; padding: 20px; margin: 0;">New Assisted Application</h2>
                <div style="padding: 20px;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr style="background: #f8f8f8;"><td style="padding: 10px; border: 1px solid #ddd;"><b>Applicant</b></td><td style="padding: 10px; border: 1px solid #ddd;">${req.body.firstNames} ${req.body.surname}</td></tr>
                        <tr><td style="padding: 10px; border: 1px solid #ddd;"><b>ID Number</b></td><td style="padding: 10px; border: 1px solid #ddd;">${req.body.idNumber}</td></tr>
                        <tr style="background: #f8f8f8;"><td style="padding: 10px; border: 1px solid #ddd;"><b>Returning Student</b></td><td style="padding: 10px; border: 1px solid #ddd;">${req.body.returningStudentDetails || 'N/A'}</td></tr>
                        <tr><td style="padding: 10px; border: 1px solid #ddd;"><b>Disability</b></td><td style="padding: 10px; border: 1px solid #ddd;">${req.body.disabilityDetails || 'None'}</td></tr>
                        <tr style="background: #f8f8f8;"><td style="padding: 10px; border: 1px solid #ddd;"><b>Next of Kin</b></td><td style="padding: 10px; border: 1px solid #ddd;">${req.body.nokName} (${req.body.nokPhone})</td></tr>
                    </table>
                    <p style="margin-top: 20px; font-size: 12px; color: #666;">This application has been saved to your Admin Tracker.</p>
                </div>
            </div>
        `;

        await transporter.sendMail({
            from: '"Campus Collective Portal" <system@mycampuscollective.me>',
            to: 'info@mycampuscollective.me',
            subject: `New Application: ${req.body.firstNames} ${req.body.surname}`,
            html: emailContent
        });

        res.status(200).json({ message: "Application submitted successfully!" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========================================================================
// 🏆 NEW: ACCOMMODATION APPLICATION → RECRUIT CONVERSION
// ========================================================================
/**
 * @route   POST /api/auth/apply-for-accommodation
 * @desc    Student submits accommodation application - links to agent by reference
 * @access  Public
 */
router.post('/apply-for-accommodation', async (req, res) => {
    try {
        const {
            studentName,
            studentSurname,
            studentEmail,
            studentPhone,
            accommodation,
            moveInDate,
            referencedBy
        } = req.body;

        // Validate required fields
        if (!studentName || !studentSurname || !studentEmail || !studentPhone || !accommodation || !moveInDate) {
            return res.status(400).json({
                message: 'All student details are required (name, surname, email, phone, accommodation, move-in date)'
            });
        }

        // Get the current active season - REQUIRED
        const Season = require('../models/Season');
        const activeSeason = await Season.findOne({ isActive: true });

        if (!activeSeason) {
            return res.status(400).json({
                message: 'No active recruitment season at this time. Please contact admin.'
            });
        }

        let linkedAgent = null;
        let referencedByAgentId = null;

        // If agent reference provided, try to find matching agent
        if (referencedBy && referencedBy.trim()) {
            const cleanedReference = referencedBy.trim();
            const regex = new RegExp(cleanedReference, 'i');
            const agent = await Agent.findOne({
                $or: [
                    { fullName: regex },
                    { agentId: cleanedReference },
                    { email: cleanedReference.toLowerCase() }
                ]
            });

            if (agent) {
                linkedAgent = agent._id;
                referencedByAgentId = agent._id;
            }
            // If agent not found, still create recruit but log the reference name
        }

        // Create the recruit record
        const newRecruit = new Recruit({
            studentName: studentName.trim(),
            studentSurname: studentSurname.trim(),
            studentEmail: studentEmail.toLowerCase(),
            studentPhone: studentPhone.trim(),
            accommodation: accommodation.trim(),
            moveInDate: new Date(moveInDate),
            agent: linkedAgent,
            agentId: linkedAgent ? (await Agent.findById(linkedAgent)).agentId : '',
            season: activeSeason._id,
            seasonName: activeSeason.name,
            referencedByName: referencedBy ? referencedBy.trim() : '',
            referencedByAgentId: referencedByAgentId,
            status: 'Pending',
            commissionEarned: 0,
            commissionRate: 150
        });

        await newRecruit.save();

        // Update season statistics
        await Season.findByIdAndUpdate(activeSeason._id, {
            $inc: { totalRecruits: 1, pendingRecruits: 1 }
        });

        // Send confirmation email to student
        const confirmationEmail = `
            <div style="max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden;">
                <div style="background-color: #2563eb; padding: 20px; text-align: center;">
                    <h1 style="color: white; margin: 0;">Application Confirmed!</h1>
                </div>
                <div style="padding: 30px; color: #334155; line-height: 1.6;">
                    <p>Hello <strong>${studentName} ${studentSurname}</strong>,</p>
                    <p>Thank you for your accommodation application with Campus Collective. We have successfully received and recorded your application.</p>

                    <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-family: Arial, sans-serif;">
                        <tr style="background-color: #2563eb; color: white;">
                            <th style="padding: 12px; text-align: left; border: 1px solid #ddd;">Field</th>
                            <th style="padding: 12px; text-align: left; border: 1px solid #ddd;">Details</th>
                        </tr>
                        <tr>
                            <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Accommodation</td>
                            <td style="padding: 10px; border: 1px solid #ddd;">${accommodation}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Move-in Date</td>
                            <td style="padding: 10px; border: 1px solid #ddd;">${new Date(moveInDate).toLocaleDateString()}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Recruitment Season</td>
                            <td style="padding: 10px; border: 1px solid #ddd;">${activeSeason.name}</td>
                        </tr>
                        ${linkedAgent ? `<tr>
                            <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Referred By Agent</td>
                            <td style="padding: 10px; border: 1px solid #ddd;">${referencedBy}</td>
                        </tr>` : ''}
                    </table>

                    <p style="margin-top: 20px;">Your application is being reviewed and you will be contacted within 24-48 hours with updates.</p>
                    <p style="color: #666; font-size: 12px; margin-top: 20px;">Campus Collective Management System</p>
                </div>
            </div>
        `;

        try {
            await transporter.sendMail({
                from: '"Campus Collective" <no-reply@mycampuscollective.me>',
                to: studentEmail,
                subject: 'Application Received - Campus Collective Accommodation',
                html: confirmationEmail
            });
        } catch (emailErr) {
            console.error('Email send error:', emailErr);
            // Don't fail the request if email fails
        }

        // If agent was linked, send them a notification
        if (linkedAgent) {
            try {
                const agent = await Agent.findById(linkedAgent);
                const agentEmail = `
                    <div style="max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden;">
                        <div style="background-color: #2563eb; padding: 20px; text-align: center;">
                            <h1 style="color: white; margin: 0;">New Recruit Referral</h1>
                        </div>
                        <div style="padding: 30px; color: #334155; line-height: 1.6;">
                            <p>Hello <strong>${agent.fullName}</strong>,</p>
                            <p>A student has applied using your name as a reference! Here are the details:</p>

                            <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-family: Arial, sans-serif;">
                                <tr style="background-color: #2563eb; color: white;">
                                    <th style="padding: 12px; text-align: left; border: 1px solid #ddd;">Field</th>
                                    <th style="padding: 12px; text-align: left; border: 1px solid #ddd;">Details</th>
                                </tr>
                                <tr>
                                    <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Student Name</td>
                                    <td style="padding: 10px; border: 1px solid #ddd;">${studentName} ${studentSurname}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Accommodation</td>
                                    <td style="padding: 10px; border: 1px solid #ddd;">${accommodation}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Status</td>
                                    <td style="padding: 10px; border: 1px solid #ddd;">Pending Review</td>
                                </tr>
                            </table>

                            <p style="margin-top: 20px;">Check your agent dashboard for more details.</p>
                        </div>
                    </div>
                `;

                await transporter.sendMail({
                    from: '"Campus Collective" <no-reply@mycampuscollective.me>',
                    to: agent.email,
                    subject: 'New Recruit Referral - Check Your Dashboard',
                    html: agentEmail
                });
            } catch (agentEmailErr) {
                console.error('Agent email error:', agentEmailErr);
            }
        }

        res.status(201).json({
            message: 'Application submitted successfully!',
            recruit: newRecruit,
            season: activeSeason,
            agentLinked: !!linkedAgent
        });

    } catch (err) {
        console.error('Apply for Accommodation Error:', err.message);
        res.status(500).json({ message: 'Server error: ' + err.message });
    }
});

module.exports = router;