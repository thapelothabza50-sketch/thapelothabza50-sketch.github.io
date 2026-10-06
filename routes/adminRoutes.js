const express = require('express');
const router = express.Router();
const { auth, hasRole } = require('../middleware/auth');
const Seller = require('../models/Seller');
const Agent = require('../models/Agent');
const Team = require('../models/Team');
const Student = require('../models/Student');
const User = require('../models/User');
const Recruit = require('../models/Recruit');
const nodemailer = require('nodemailer');
const Season = require('../models/Season');
const Accommodation = require('../models/Accommodation');
const Upload = require('../models/Upload');
const Landlord = require('../models/Landlord');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

// --- GET ALL PROFILES ---
// This allows admin to see the new banking details in the management dashboard
router.get('/profiles', auth, hasRole(['Admin']), async (req, res) => {
    try {
        const sellers = await Seller.find().select('-password');
        const agents = await Agent.find().select('-password');
        const allProfiles = [...sellers, ...agents];
        res.json(allProfiles);
    } catch (err) {
        console.error('Admin Fetch Error:', err.message);
        res.status(500).json({ message: 'Server Error' });
    }
});

// --- NEW: UPDATE AGENT BANKING DETAILS ---
// This route matches the fetch call I added to your Agent Dashboard
router.post('/update-banking', auth, async (req, res) => {
    try {
        const { banking } = req.body;
        
        // Find the agent by their ID (from the auth token) and update their banking object
        const agent = await Agent.findByIdAndUpdate(
            req.user.id, 
            { $set: { banking: banking } }, 
            { new: true }
        ).select('-password');

        if (!agent) return res.status(404).json({ message: 'Agent not found' });

        res.json({ message: 'Banking details updated successfully', agent });
    } catch (err) {
        console.error('Banking Update Error:', err.message);
        res.status(500).json({ message: 'Server error: ' + err.message });
    }
});

// --- SUBMIT RECRUIT ---
router.post('/submit-recruit', auth, async (req, res) => {
    try {
        const { studentName, studentSurname, studentEmail, accommodation, moveInDate } = req.body;

        const newRecruit = new Recruit({
            studentName,
            studentSurname,
            studentEmail,
            accommodation,
            institution: req.user.institution || 'Other',
            moveInDate,
            agent: req.user.id,
            status: 'Pending',
            commissionEarned: 0
        });

        await newRecruit.save();
        res.status(201).json({ message: 'Recruit added successfully', recruit: newRecruit });
    } catch (err) {
        console.error('Submit Recruit Error:', err.message);
        res.status(500).json({ message: 'Server error: ' + err.message });
    }
});

// --- GET RECRUITS ---
router.get('/recruits', auth, async (req, res) => {
    try {
        let filter = {};
        if (req.user.role.toLowerCase() !== 'admin') {
            filter = { agent: req.user.id };
        }
        const recruits = await Recruit.find(filter).sort({ createdAt: -1 });
        res.json(recruits);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching recruits' });
    }
});

// --- TOGGLE LOCK ---
// --- TOGGLE LOCK / APPROVAL ---
router.post('/toggle-lock', auth, hasRole(['Admin']), async (req, res) => {
    const { userId, status } = req.body;
    try {
        let user = await Seller.findByIdAndUpdate(userId, { status }, { new: true });
        let userType = 'Seller';
        
        if (!user) {
            user = await Agent.findByIdAndUpdate(userId, { status }, { new: true });
            userType = 'Agent';
        }
        if (!user) return res.status(404).json({ message: 'User not found' });

        // --- AUTOMATED EMAIL UPON APPROVAL ---
        if (status.toLowerCase() === 'approved') {
            try {
                const transporter = nodemailer.createTransport({
                    service: 'gmail', // Or your email provider
                    auth: {
                        user: process.env.EMAIL_USER,
                        pass: process.env.EMAIL_PASS
                    }
                });

                const mailOptions = {
                    from: process.env.EMAIL_USER,
                    to: user.email,
                    subject: '🎉 Your Campus Collective Account Has Been Approved!',
                    html: `
                        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto;">
                            <h2 style="color: #2563eb;">Congratulations, ${user.fullName || user.businessName}!</h2>
                            <p>Your account status has been updated to <strong>Approved</strong> by the administrator.</p>
                            <p>You can go and create your products now! All restrictions have been lifted from your seller account.</p>
                            
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="https://www.mycampuscollective.me/login%20czra.html" 
                                   style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                                   Log in now
                                </a>
                            </div>

                            <p style="font-size: 12px; color: #666; word-break: break-all;">
                                If the button doesn't work, copy and paste this link into your browser:<br>
                                https://www.mycampuscollective.me/login%20czra.html
                            </p>
                            <br>
                            <p>Best regards,</p>
                            <p><strong>Campus Collective Team</strong></p>
                        </div>
                    `
                };

                await transporter.sendMail(mailOptions);
                console.log(`Approval email sent to ${user.email}`);
            } catch (emailErr) {
                console.error('Failed to send approval email:', emailErr.message);
            }
        }

        res.json({ message: `Account successfully ${status}`, userStatus: user.status });
    } catch (err) {
        console.error('Toggle lock error:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
});

// --- APPROVE RECRUIT WITH MANUAL COMMISSION ---
// --- 1. FIXED APPROVAL WITH COMMISSION ---
router.post('/approve-recruit/:id', auth, hasRole(['Admin']), async (req, res) => {
    try {
        const { commissionAmount } = req.body; 
        const recruit = await Recruit.findById(req.params.id);
        if (!recruit) return res.status(404).json({ message: 'Recruit not found' });

        recruit.status = 'Approved';
        recruit.commissionEarned = parseFloat(commissionAmount) || 0; 
        await recruit.save();

        // 🏆 NEW: Add the commission to the Agent's total balance
        await Agent.findByIdAndUpdate(recruit.agent, {
            $inc: { balance: recruit.commissionEarned } // Ensure 'balance' exists in Agent.js
        });

        res.json({ message: 'Recruit approved and commission added to Agent' });
    } catch (err) {
        res.status(500).json({ message: 'Error approving recruit' });
    }
});

// --- 2. NEW: DELETE USER ROUTE ---
// --- DELETE USER ACCOUNT (Agent or Seller) ---
router.delete('/delete-user/:id', auth, hasRole(['Admin']), async (req, res) => {
    try {
        // Search and delete in both collections
        let deletedUser = await Seller.findByIdAndDelete(req.params.id);
        if (!deletedUser) {
            deletedUser = await Agent.findByIdAndDelete(req.params.id);
        }

        if (!deletedUser) return res.status(404).json({ message: 'User not found' });

        res.json({ message: 'Account permanently deleted.' });
    } catch (err) {
        res.status(500).json({ message: 'Server error during deletion' });
    }
});

// --- 3. NEW: DELETE RECRUIT ROUTE ---
router.delete('/delete-recruit/:id', auth, hasRole(['Admin']), async (req, res) => {
    try {
        const recruit = await Recruit.findByIdAndDelete(req.params.id);
        if (!recruit) return res.status(404).json({ message: 'Recruit not found' });
        res.json({ message: 'Recruit deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Error deleting recruit' });
    }
});


// ========================================================================
// 🏆 SEASON MANAGEMENT ROUTES
// ========================================================================

/**
 * @route   POST /api/admin/seasons
 * @desc    Create a new recruitment season
 * @access  Private (Admin Only)
 */
router.post('/seasons', auth, hasRole(['Admin']), async (req, res) => {
    try {
        const { name, semester, year, startDate, endDate, isActive } = req.body;

        // Validate dates
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (end <= start) {
            return res.status(400).json({ message: 'End date must be after start date' });
        }

        // Check if season with same semester and year already exists
        const existingSeason = await Season.findOne({ semester, year });
        if (existingSeason) {
            return res.status(400).json({ message: `${semester} Semester ${year} already exists` });
        }

        const newSeason = new Season({
            name,
            semester,
            year,
            startDate: start,
            endDate: end,
            isActive: isActive || false,
            status: 'active'
        });

        await newSeason.save();
        res.status(201).json({ message: 'Season created successfully', season: newSeason });
    } catch (err) {
        console.error('Season Creation Error:', err.message);
        res.status(500).json({ message: 'Error creating season: ' + err.message });
    }
});

/**
 * @route   GET /api/admin/seasons
 * @desc    Get all recruitment seasons
 * @access  Private (Admin Only)
 */
router.get('/seasons', auth, hasRole(['Admin']), async (req, res) => {
    try {
        const seasons = await Season.find().sort({ year: -1, semester: -1 });
        res.json(seasons);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching seasons' });
    }
});

/**
 * @route   GET /api/admin/seasons/active
 * @desc    Get current active season
 * @access  Private (Admin & Agents)
 */
router.get('/seasons/active', auth, async (req, res) => {
    try {
        const activeSeason = await Season.findOne({ isActive: true });
        if (!activeSeason) {
            return res.status(404).json({ message: 'No active season found' });
        }
        res.json(activeSeason);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching active season' });
    }
});

/**
 * @route   PUT /api/admin/seasons/:id/set-active
 * @desc    Set a season as active (deactivates all others)
 * @access  Private (Admin Only)
 */
router.put('/seasons/:id/set-active', auth, hasRole(['Admin']), async (req, res) => {
    try {
        const season = await Season.findByIdAndUpdate(
            req.params.id,
            { isActive: true, status: 'active' },
            { new: true }
        );
        if (!season) return res.status(404).json({ message: 'Season not found' });
        
        res.json({ message: 'Season set as active', season });
    } catch (err) {
        res.status(500).json({ message: 'Error updating season' });
    }
});

/**
 * @route   PUT /api/admin/seasons/:id/end
 * @desc    Mark a season as ended
 * @access  Private (Admin Only)
 */
router.put('/seasons/:id/end', auth, hasRole(['Admin']), async (req, res) => {
    try {
        const season = await Season.findByIdAndUpdate(
            req.params.id,
            { isActive: false, status: 'ended', endDate: new Date() },
            { new: true }
        );
        if (!season) return res.status(404).json({ message: 'Season not found' });
        
        res.json({ message: 'Season marked as ended', season });
    } catch (err) {
        res.status(500).json({ message: 'Error ending season' });
    }
});

/**
 * @route   PUT /api/admin/seasons/:id/archive
 * @desc    Archive a season
 * @access  Private (Admin Only)
 */
router.put('/seasons/:id/archive', auth, hasRole(['Admin']), async (req, res) => {
    try {
        const season = await Season.findByIdAndUpdate(
            req.params.id,
            { status: 'archived', isActive: false },
            { new: true }
        );
        if (!season) return res.status(404).json({ message: 'Season not found' });
        
        res.json({ message: 'Season archived successfully', season });
    } catch (err) {
        res.status(500).json({ message: 'Error archiving season' });
    }
});

/**
 * @route   GET /api/admin/recruits/by-season/:seasonId
 * @desc    Get all recruits for a specific season
 * @access  Private (Admin Only)
 */
router.get('/recruits/by-season/:seasonId', auth, hasRole(['Admin']), async (req, res) => {
    try {
        const recruits = await Recruit.find({ season: req.params.seasonId })
            .populate('agent', 'fullName email agentId')
            .populate('season', 'name semester year')
            .sort({ createdAt: -1 });
        
        res.json(recruits);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching recruits for season' });
    }
});

/**
 * @route   GET /api/admin/recruits/all-with-seasons
 * @desc    Get all recruits grouped by season (for dashboard with filters)
 * @access  Private (Admin Only)
 */
router.get('/recruits/all-with-seasons', auth, hasRole(['Admin']), async (req, res) => {
    try {
        // Get all seasons sorted by year/semester
        const seasons = await Season.find().sort({ year: -1, semester: -1 });
        
        // For each season, get recruit counts by status
        const seasonData = [];
        for (const season of seasons) {
            const recruits = await Recruit.find({ season: season._id });
            const stats = {
                total: recruits.length,
                approved: recruits.filter(r => r.status === 'Approved').length,
                pending: recruits.filter(r => r.status === 'Pending').length,
                cancelled: recruits.filter(r => r.status === 'Cancelled').length,
            };
            
            seasonData.push({
                season,
                stats,
                recruits
            });
        }
        
        res.json(seasonData);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching recruits with seasons' });
    }
});

/**
 * @route   GET /api/admin/dashboard/recruits
 * @desc    Smart dashboard - active season recruits + filter for past
 * @access  Private (Admin Only)
 */
router.get('/dashboard/recruits', auth, hasRole(['Admin', 'RestrictedAdmin']), async (req, res) => {
    try {
        const { seasonId, status } = req.query;
        
        let filter = {};
        
        // If seasonId provided, use it (for filtering past seasons)
        if (seasonId) {
            filter.season = seasonId;
        } else {
            // Default: show current active season
            const activeSeason = await Season.findOne({ isActive: true });
            if (activeSeason) {
                filter.season = activeSeason._id;
            }
        }
        
        // Restricted admins only see their own recruits
        if (req.user.role.toLowerCase() !== 'admin') {
            filter.agent = req.user.id;
        }
        
        // Filter by status if provided
        if (status) {
            filter.status = status;
        }
        
        const recruits = await Recruit.find(filter)
            .populate('agent', 'fullName email agentId')
            .populate('season', 'name semester year')
            .sort({ createdAt: -1 });
        
        // Get active season info
        const activeSeason = await Season.findOne({ isActive: true });
        
        res.json({
            currentSeason: activeSeason,
            recruits,
            count: recruits.length
        });
    } catch (err) {
        console.error('Dashboard Error:', err.message);
        res.status(500).json({ message: 'Error fetching dashboard data' });
    }
});

// ========================================================================
// 🏢 ACCOMMODATION MANAGEMENT ROUTES
// ========================================================================

// Multer configuration for accommodation image uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

const contractStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../uploads/admin-files');
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const sanitized = file.originalname.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_.-]/g, '');
        cb(null, `${Date.now()}-${sanitized}`);
    }
});
const fileUpload = multer({ storage: contractStorage });

// Helper function to generate slug from name
function generateSlug(name) {
    return name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
}

// Helper function to generate HTML file from template
function generateAccommodationHTML(accommodation) {
    try {
        let template = fs.readFileSync(path.join(__dirname, '../accommodation-template.html'), 'utf8');

        // Generate gallery images HTML
        const galleryImages = accommodation.images.map(img =>
            `<img src="${img}" alt="${accommodation.name}" class="gallery-img">`
        ).join('');

        // Generate room types HTML
        const roomTypesHtml = accommodation.roomTypes.map(room => `
            <div class="card p-6 room-card">
                <h3 class="text-xl font-bold text-gray-800 mb-3">${room.type} Room</h3>
                <p class="text-2xl font-black text-blue-600 mb-2">R ${room.pricePerMonth}/month</p>
                <p class="text-gray-600 text-sm mb-4">Available: ${room.availability} room(s)</p>
                ${room.amenities && room.amenities.length > 0 ? `
                    <div class="text-xs space-y-1">
                        ${room.amenities.map(amenity => `<p>✓ ${amenity}</p>`).join('')}
                    </div>
                ` : ''}
            </div>
        `).join('');

        // Generate amenities HTML
        const amenitiesHtml = accommodation.amenities.map(amenity =>
            `<div class="p-3 bg-blue-50 rounded-lg text-center font-bold text-gray-700">✓ ${amenity}</div>`
        ).join('');

        // NSFAS badge
        const nsfasAccreditedBadge = accommodation.nsfasAccredited
            ? '<div class="inline-block bg-green-100 text-green-700 px-4 py-2 rounded-full text-sm font-bold mb-4">✓ NSFAS Accredited</div>'
            : '';

        // Replace placeholders
        let html = template
            .replace(/{{name}}/g, accommodation.name)
            .replace(/{{nameEncoded}}/g, encodeURIComponent(accommodation.name))
            .replace(/{{description}}/g, accommodation.description)
            .replace(/{{location}}/g, accommodation.location)
            .replace(/{{contactPhone}}/g, accommodation.contactPhone)
            .replace(/{{contactEmail}}/g, accommodation.contactEmail)
            .replace(/{{mainImage}}/g, accommodation.images[0] || 'Images/placeholder.jpg')
            .replace(/{{galleryImages}}/g, galleryImages)
            .replace(/{{roomTypesHtml}}/g, roomTypesHtml)
            .replace(/{{amenitiesHtml}}/g, amenitiesHtml)
            .replace(/{{nsfasAccreditedBadge}}/g, nsfasAccreditedBadge);

        return html;
    } catch (err) {
        console.error('HTML Generation Error:', err.message);
        return null;
    }
}

/**
 * @route   POST /api/admin/accommodations
 * @desc    Create new accommodation with images
 * @access  Private (Admin Only)
 */
router.post('/accommodations', auth, hasRole(['Admin', 'RestrictedAdmin']), upload.array('images'), async (req, res) => {
    try {
        const { name, location, description, roomTypes, amenities, nsfasAccredited, contactPhone, contactEmail, landlordId, institution } = req.body;

        // Validate required fields
        if (!name || !location) {
            return res.status(400).json({ message: 'Name and location are required' });
        }

        // Validate landlord exists if provided
        if (landlordId) {
            const landlord = await Landlord.findById(landlordId);
            if (!landlord) {
                return res.status(400).json({ message: 'Selected landlord not found' });
            }
        }

        // Generate slug and check if accommodation already exists
        const slug = generateSlug(name);
        const existingAccommodation = await Accommodation.findOne({ slug });
        if (existingAccommodation) {
            return res.status(400).json({ message: 'An accommodation with this name already exists' });
        }

        // Get image URLs from uploaded files
        const imageUrls = req.files ? req.files.map(file => `/uploads/${file.filename}`) : [];

        // Parse room types and amenities (they come as JSON strings from form)
        let parsedRoomTypes = [];
        let parsedAmenities = [];

        if (roomTypes) {
            parsedRoomTypes = typeof roomTypes === 'string' ? JSON.parse(roomTypes) : roomTypes;
        }
        if (amenities) {
            parsedAmenities = typeof amenities === 'string' ? JSON.parse(amenities) : amenities;
        }

        // Create accommodation
        const newAccommodation = new Accommodation({
            name,
            slug,
            location,
            institution: institution || 'Other',
            description: description || '',
            images: imageUrls,
            roomTypes: parsedRoomTypes,
            amenities: parsedAmenities,
            nsfasAccredited: nsfasAccredited === 'true' || nsfasAccredited === true,
            contactPhone: contactPhone || '',
            contactEmail: contactEmail || '',
            landlordId: landlordId || null
        });

        await newAccommodation.save();

        // Generate HTML file
        const html = generateAccommodationHTML(newAccommodation);
        if (html) {
            const filePath = path.join(__dirname, `../${slug}.html`);
            fs.writeFileSync(filePath, html, 'utf8');
            newAccommodation.htmlPageGenerated = true;
            await newAccommodation.save();
        }

        res.status(201).json({
            message: 'Accommodation created successfully',
            accommodation: newAccommodation,
            pageUrl: `/${slug}.html`
        });
    } catch (err) {
        console.error('Accommodation Creation Error:', err.message);
        res.status(500).json({ message: 'Server error: ' + err.message });
    }
});

/**
 * @route   GET /api/admin/accommodations
 * @desc    Get all accommodations (for admin dashboard)
 * @access  Private (Admin Only)
 */
router.get('/accommodations', auth, hasRole(['Admin', 'RestrictedAdmin']), async (req, res) => {
    try {
        const filter = {};
        if (req.query.institution) {
            filter.institution = req.query.institution;
        }
        if (req.user.role.toLowerCase() !== 'admin') {
            filter.institution = req.user.institution || req.query.institution || filter.institution;
        }
        const accommodations = await Accommodation.find(filter)
            .populate('landlordId', 'fullName email')
            .sort({ createdAt: -1 });

        res.json(accommodations);
    } catch (err) {
        console.error('Fetch Accommodations Error:', err.message);
        res.status(500).json({ message: 'Error fetching accommodations' });
    }
});

/**
 * @route   GET /api/accommodations
 * @desc    Get all active accommodations (public, for agent dashboard)
 * @access  Public
 */
router.get('/accommodations-public', async (req, res) => {
    try {
        const filter = { isActive: true };
        if (req.query.institution) {
            filter.institution = req.query.institution;
        }
        const accommodations = await Accommodation.find(filter)
            .sort({ createdAt: -1 });

        res.json(accommodations);
    } catch (err) {
        console.error('Fetch Public Accommodations Error:', err.message);
        res.status(500).json({ message: 'Error fetching accommodations' });
    }
});

/**
 * @route   GET /api/accommodations/:slug
 * @desc    Get single accommodation by slug
 * @access  Public
 */
router.get('/accommodations-detail/:slug', async (req, res) => {
    try {
        const accommodation = await Accommodation.findOne({ slug: req.params.slug })
            .populate('landlordId', 'fullName email phone');

        if (!accommodation) {
            return res.status(404).json({ message: 'Accommodation not found' });
        }

        res.json(accommodation);
    } catch (err) {
        console.error('Fetch Accommodation Detail Error:', err.message);
        res.status(500).json({ message: 'Error fetching accommodation' });
    }
});

/**
 * @route   PUT /api/admin/accommodations/:id
 * @desc    Update accommodation
 * @access  Private (Admin Only)
 */
router.put('/accommodations/:id', auth, hasRole(['Admin', 'RestrictedAdmin']), upload.array('images'), async (req, res) => {
    try {
        const { name, location, description, roomTypes, amenities, nsfasAccredited, contactPhone, contactEmail, landlordId, institution } = req.body;

        let accommodation = await Accommodation.findById(req.params.id);
        if (!accommodation) {
            return res.status(404).json({ message: 'Accommodation not found' });
        }

        // Validate landlord if provided
        if (landlordId && landlordId !== accommodation.landlordId.toString()) {
            const landlord = await Landlord.findById(landlordId);
            if (!landlord) {
                return res.status(400).json({ message: 'Selected landlord not found' });
            }
        }

        // Update fields
        if (name) accommodation.name = name;
        if (location) accommodation.location = location;
        if (description !== undefined) accommodation.description = description;
        if (nsfasAccredited !== undefined) accommodation.nsfasAccredited = nsfasAccredited === 'true' || nsfasAccredited === true;
        if (contactPhone) accommodation.contactPhone = contactPhone;
        if (contactEmail) accommodation.contactEmail = contactEmail;
        if (landlordId) accommodation.landlordId = landlordId;
        if (institution) accommodation.institution = institution;

        // Add new images (keep existing ones)
        if (req.files && req.files.length > 0) {
            const newImageUrls = req.files.map(file => `/uploads/${file.filename}`);
            accommodation.images = [...accommodation.images, ...newImageUrls];
        }

        // Update room types and amenities if provided
        if (roomTypes) {
            accommodation.roomTypes = typeof roomTypes === 'string' ? JSON.parse(roomTypes) : roomTypes;
        }
        if (amenities) {
            accommodation.amenities = typeof amenities === 'string' ? JSON.parse(amenities) : amenities;
        }

        await accommodation.save();

        // Regenerate HTML file
        const html = generateAccommodationHTML(accommodation);
        if (html) {
            const filePath = path.join(__dirname, `../${accommodation.slug}.html`);
            fs.writeFileSync(filePath, html, 'utf8');
        }

        res.json({
            message: 'Accommodation updated successfully',
            accommodation
        });
    } catch (err) {
        console.error('Accommodation Update Error:', err.message);
        res.status(500).json({ message: 'Server error: ' + err.message });
    }
});

/**
 * @route   DELETE /api/admin/accommodations/:id
 * @desc    Delete accommodation
 * @access  Private (Admin Only)
 */
router.delete('/accommodations/:id', auth, hasRole(['Admin']), async (req, res) => {
    try {
        const accommodation = await Accommodation.findById(req.params.id);
        if (!accommodation) {
            return res.status(404).json({ message: 'Accommodation not found' });
        }

        // Delete HTML file
        const filePath = path.join(__dirname, `../${accommodation.slug}.html`);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        // Delete accommodation from database
        await Accommodation.findByIdAndDelete(req.params.id);

        res.json({ message: 'Accommodation deleted successfully' });
    } catch (err) {
        console.error('Accommodation Delete Error:', err.message);
        res.status(500).json({ message: 'Server error: ' + err.message });
    }
});

/**
 * @route   PUT /api/admin/agent/:id/role
 * @desc    Flag an agent as restricted admin or update institution
 * @access  Private (Admin Only)
 */
router.put('/agent/:id/role', auth, hasRole(['Admin']), async (req, res) => {
    try {
        const { institution, isRestrictedAdmin } = req.body;
        const update = {};
        if (institution) update.institution = institution;
        if (typeof isRestrictedAdmin !== 'undefined') {
            update.isRestrictedAdmin = Boolean(isRestrictedAdmin);
            update.role = isRestrictedAdmin ? 'RestrictedAdmin' : 'Agent';
        }

        const agent = await Agent.findByIdAndUpdate(req.params.id, update, { new: true }).select('-password');
        if (!agent) return res.status(404).json({ message: 'Agent not found' });

        res.json({ message: 'Agent role updated successfully', agent });
    } catch (err) {
        console.error('Agent Role Update Error:', err.message);
        res.status(500).json({ message: 'Error updating agent role' });
    }
});

/**
 * @route   POST /api/admin/uploads
 * @desc    Upload a contract or progress report
 * @access  Private (Admin & RestrictedAdmin)
 */
router.post('/uploads', auth, hasRole(['Admin', 'RestrictedAdmin']), fileUpload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'File upload is required' });
        }

        const { category, institution } = req.body;
        const uploadRecord = new Upload({
            originalName: req.file.originalname,
            fileName: req.file.filename,
            url: `/uploads/admin-files/${req.file.filename}`,
            category: category || 'Other',
            institution: institution || 'Other',
            uploadedBy: req.user.id,
            uploadedByName: req.user.fullName || req.user.agentId || 'Unknown',
            uploadedByRole: req.user.role || 'Agent'
        });

        await uploadRecord.save();
        res.status(201).json({ message: 'File uploaded successfully', upload: uploadRecord });
    } catch (err) {
        console.error('Upload Error:', err.message);
        res.status(500).json({ message: 'Error uploading file' });
    }
});

/**
 * @route   GET /api/admin/uploads
 * @desc    Get uploaded contracts and reports
 * @access  Private (Admin & RestrictedAdmin)
 */
router.get('/uploads', auth, hasRole(['Admin', 'RestrictedAdmin']), async (req, res) => {
    try {
        const filter = {};
        if (req.user.role.toLowerCase() !== 'admin') {
            filter.uploadedBy = req.user.id;
        }
        if (req.query.institution) {
            filter.institution = req.query.institution;
        }
        const uploads = await Upload.find(filter).sort({ createdAt: -1 });
        res.json(uploads);
    } catch (err) {
        console.error('Fetch Uploads Error:', err.message);
        res.status(500).json({ message: 'Error fetching uploads' });
    }
});


// ========================================================================
// AGENT PERFORMANCE / RECRUIT COMMAND CENTRE
// ========================================================================

const escapeHtml = (value = '') => String(value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');

const normaliseName = (value = '') =>
    String(value).toLowerCase().normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ').trim();

const levenshtein = (a, b) => {
    a = normaliseName(a); b = normaliseName(b);
    if (!a) return b.length;
    if (!b) return a.length;
    const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 0; i < a.length; i++) {
        let cur = [i + 1];
        for (let j = 0; j < b.length; j++) {
            cur[j + 1] = Math.min(
                cur[j] + 1,
                prev[j + 1] + 1,
                prev[j] + (a[i] === b[j] ? 0 : 1)
            );
        }
        for (let j = 0; j < cur.length; j++) prev[j] = cur[j];
    }
    return prev[b.length];
};

const nameSimilarity = (input, agentName) => {
    const a = normaliseName(input);
    const b = normaliseName(agentName);
    if (!a || !b) return 0;
    if (a === b) return 1;
    const at = a.split(' ');
    const bt = b.split(' ');
    const tokenScores = at.map(token => {
        if (!token) return 0;
        return Math.max(...bt.map(x => {
            const d = levenshtein(token, x);
            return 1 - d / Math.max(token.length, x.length, 1);
        }));
    });
    const tokenAvg = tokenScores.reduce((x, y) => x + y, 0) / tokenScores.length;
    const whole = 1 - levenshtein(a, b) / Math.max(a.length, b.length);
    const firstLastBoost = at.length >= 2 && bt.length >= 2
        ? (Math.max(
            1 - levenshtein(at[0], bt[0]) / Math.max(at[0].length, bt[0].length, 1),
            1 - levenshtein(at.at(-1), bt.at(-1)) / Math.max(at.at(-1).length, bt.at(-1).length, 1)
        ) * 0.15) : 0;
    return Math.min(1, tokenAvg * 0.55 + whole * 0.30 + firstLastBoost);
};

router.get('/agent-performance', auth, hasRole(['Admin', 'RestrictedAdmin']), async (req, res) => {
    try {
        const agents = await Agent.find({ role: 'Agent' })
            .select('-password').populate('team', 'name').populate('headAgent', 'fullName');
        const recruits = await Recruit.find().select('agent referencedByAgentId status commissionEarned createdAt');
        const rows = agents.map(agent => {
            const mine = recruits.filter(r => {
                const ids = [r.agent, r.referencedByAgentId].filter(Boolean).map(String);
                return ids.includes(String(agent._id));
            });
            const approved = mine.filter(r => r.status === 'Approved').length;
            const pending = mine.filter(r => r.status === 'Pending').length;
            const cancelled = mine.filter(r => r.status === 'Cancelled').length;
            return {
                agent: agent,
                total: mine.length,
                approved,
                pending,
                cancelled,
                conversionRate: mine.length ? Math.round((approved / mine.length) * 1000) / 10 : 0,
                commission: mine.reduce((sum, r) => sum + (Number(r.commissionEarned) || 0), 0)
            };
        }).sort((a, b) => b.total - a.total || b.approved - a.approved);
        res.json({ agents: rows });
    } catch (err) {
        console.error('Agent performance error:', err);
        res.status(500).json({ message: 'Unable to calculate agent performance' });
    }
});

router.get('/recruits/:id/details', auth, hasRole(['Admin', 'RestrictedAdmin']), async (req, res) => {
    try {
        const recruit = await Recruit.findById(req.params.id)
            .populate('agent', 'fullName email phone agentId role isHeadAgent')
            .populate('referencedByAgentId', 'fullName email phone agentId')
            .populate('season', 'name semester year');
        if (!recruit) return res.status(404).json({ message: 'Recruit not found' });
        const student = await Student.findOne({
            $or: [
                { email: recruit.studentEmail },
                { phone: recruit.studentPhone }
            ]
        }).sort({ createdAt: -1 });
        res.json({ recruit, student });
    } catch (err) {
        console.error('Recruit details error:', err);
        res.status(500).json({ message: 'Unable to load recruit details' });
    }
});

router.put('/recruits/:id/assign-agent', auth, hasRole(['Admin']), async (req, res) => {
    try {
        const { agentId } = req.body;
        const recruit = await Recruit.findById(req.params.id);
        if (!recruit) return res.status(404).json({ message: 'Recruit not found' });
        const agent = agentId ? await Agent.findOne({ _id: agentId, role: 'Agent' }) : null;
        if (agentId && !agent) return res.status(404).json({ message: 'Agent not found' });

        recruit.agent = agent ? agent._id : null;
        recruit.agentId = agent ? agent.agentId : '';
        if (agent) {
            recruit.referencedByAgentId = agent._id;
            recruit.referencedByName = recruit.referencedByName || agent.fullName;
        }
        await recruit.save();
        res.json({ message: agent ? `Recruit assigned to ${agent.fullName}` : 'Recruit unassigned', recruit });
    } catch (err) {
        console.error('Assign recruit error:', err);
        res.status(500).json({ message: 'Unable to assign recruit' });
    }
});

router.post('/referrals/reconcile', auth, hasRole(['Admin']), async (req, res) => {
    try {
        const agents = await Agent.find({ role: 'Agent', status: 'active' }).select('_id fullName agentId email');
        const recruits = await Recruit.find({
            $or: [
                { referencedByAgentId: null },
                { referencedByAgentId: { $exists: false } },
                { referencedByAgentId: '' }
            ],
            referencedByName: { $nin: ['', null] }
        });

        const matched = [], ambiguous = [], unmatched = [];
        for (const recruit of recruits) {
            const input = recruit.referencedByName;
            const ranked = agents.map(agent => ({
                agent,
                score: nameSimilarity(input, agent.fullName),
                exactId: normaliseName(input) === normaliseName(agent.agentId),
                exactEmail: normaliseName(input) === normaliseName(agent.email)
            })).sort((a, b) =>
                (b.exactId || b.exactEmail ? 1 : 0) - (a.exactId || a.exactEmail ? 1 : 0) ||
                b.score - a.score
            );
            const top = ranked[0];
            const second = ranked[1];
            if (!top || top.score < 0.72) {
                unmatched.push({ recruitId: recruit._id, referencedByName: input, score: top?.score || 0 });
                continue;
            }
            if (top.score < 0.84 && second && (top.score - second.score) < 0.08) {
                ambiguous.push({
                    recruitId: recruit._id, referencedByName: input,
                    candidates: ranked.slice(0, 3).map(x => ({ agent: x.agent, score: Math.round(x.score * 100) / 100 }))
                });
                continue;
            }
            recruit.referencedByAgentId = top.agent._id;
            if (!recruit.agent) {
                recruit.agent = top.agent._id;
                recruit.agentId = top.agent.agentId || '';
            }
            await recruit.save();
            matched.push({
                recruitId: recruit._id,
                referencedByName: input,
                matchedAgent: top.agent.fullName,
                score: Math.round(top.score * 100) / 100
            });
        }
        res.json({ scanned: recruits.length, matched, ambiguous, unmatched });
    } catch (err) {
        console.error('Referral reconciliation error:', err);
        res.status(500).json({ message: 'Referral reconciliation failed' });
    }
});

router.patch('/agents/:id/leadership', auth, hasRole(['Admin']), async (req, res) => {
    try {
        const { isHeadAgent } = req.body;
        const agent = await Agent.findById(req.params.id);
        if (!agent || agent.role !== 'Agent') return res.status(404).json({ message: 'Agent not found' });
        agent.isHeadAgent = Boolean(isHeadAgent);
        if (!agent.isHeadAgent) agent.headAgent = null;
        await agent.save();
        res.json({ message: agent.isHeadAgent ? 'Agent promoted to Head Agent' : 'Head Agent status removed', agent });
    } catch (err) {
        res.status(500).json({ message: 'Unable to update agent leadership' });
    }
});

router.get('/teams', auth, hasRole(['Admin', 'RestrictedAdmin']), async (req, res) => {
    try {
        const teams = await Team.find().populate('headAgent', 'fullName email agentId').sort({ createdAt: -1 });
        const agents = await Agent.find({ role: 'Agent' }).select('-password').populate('headAgent', 'fullName').populate('team', 'name');
        res.json({ teams, agents });
    } catch (err) {
        res.status(500).json({ message: 'Unable to load teams' });
    }
});

router.post('/teams', auth, hasRole(['Admin']), async (req, res) => {
    try {
        const { name, headAgent, description } = req.body;
        if (!name || !headAgent) return res.status(400).json({ message: 'Team name and Head Agent are required' });
        const leader = await Agent.findOne({ _id: headAgent, role: 'Agent', isHeadAgent: true });
        if (!leader) return res.status(400).json({ message: 'Selected agent must be a Head Agent' });
        const team = await Team.create({ name, headAgent, description });
        leader.team = team._id;
        await leader.save();
        res.status(201).json({ message: 'Team created', team });
    } catch (err) {
        res.status(500).json({ message: 'Unable to create team: ' + err.message });
    }
});

router.put('/teams/:id', auth, hasRole(['Admin']), async (req, res) => {
    try {
        const { name, headAgent, description, isActive } = req.body;
        const team = await Team.findById(req.params.id);
        if (!team) return res.status(404).json({ message: 'Team not found' });
        if (headAgent) {
            const leader = await Agent.findOne({ _id: headAgent, role: 'Agent', isHeadAgent: true });
            if (!leader) return res.status(400).json({ message: 'Selected agent must be a Head Agent' });
            team.headAgent = leader._id;
        }
        if (name !== undefined) team.name = name;
        if (description !== undefined) team.description = description;
        if (isActive !== undefined) team.isActive = Boolean(isActive);
        await team.save();
        res.json({ message: 'Team updated', team });
    } catch (err) {
        res.status(500).json({ message: 'Unable to update team' });
    }
});

router.post('/agents/:id/team', auth, hasRole(['Admin']), async (req, res) => {
    try {
        const { teamId, headAgentId } = req.body;
        const agent = await Agent.findById(req.params.id);
        if (!agent || agent.role !== 'Agent') return res.status(404).json({ message: 'Agent not found' });

        if (teamId) {
            const team = await Team.findById(teamId);
            if (!team) return res.status(404).json({ message: 'Team not found' });
            agent.team = team._id;
            agent.headAgent = team.headAgent;
        } else if (headAgentId) {
            const head = await Agent.findOne({ _id: headAgentId, role: 'Agent', isHeadAgent: true });
            if (!head) return res.status(404).json({ message: 'Head Agent not found' });
            agent.headAgent = head._id;
        } else {
            agent.team = null;
            agent.headAgent = null;
        }
        await agent.save();
        res.json({ message: 'Agent team assignment updated', agent });
    } catch (err) {
        res.status(500).json({ message: 'Unable to assign agent' });
    }
});

router.get('/teams/performance', auth, hasRole(['Admin', 'RestrictedAdmin']), async (req, res) => {
    try {
        const teams = await Team.find({ isActive: true }).populate('headAgent', 'fullName email agentId');
        const agents = await Agent.find({ role: 'Agent' }).select('_id fullName team');
        const recruits = await Recruit.find().select('agent referencedByAgentId status commissionEarned');
        const data = teams.map(team => {
            const members = agents.filter(a => String(a.team) === String(team._id));
            const memberIds = new Set(members.map(a => String(a._id)));
            const mine = recruits.filter(r => [r.agent, r.referencedByAgentId].filter(Boolean).some(id => memberIds.has(String(id))));
            const approved = mine.filter(r => r.status === 'Approved').length;
            return {
                team,
                memberCount: members.length,
                recruitCount: mine.length,
                approved,
                pending: mine.filter(r => r.status === 'Pending').length,
                conversionRate: mine.length ? Math.round(approved / mine.length * 1000) / 10 : 0,
                commission: mine.reduce((sum, r) => sum + (Number(r.commissionEarned) || 0), 0)
            };
        }).sort((a, b) => b.recruitCount - a.recruitCount);
        res.json(data);
    } catch (err) {
        res.status(500).json({ message: 'Unable to calculate team performance' });
    }
});

router.post('/announcements', auth, hasRole(['Admin']), async (req, res) => {
    try {
        const { target = 'allAgents', teamId, agentId, subject, message } = req.body;
        if (!subject || !message) return res.status(400).json({ message: 'Subject and message are required' });

        const agents = await Agent.find({ role: 'Agent', status: 'active' }).select('email fullName team');
        let recipients = [];
        if (target === 'individual' && agentId) {
            recipients = agents.filter(a => String(a._id) === String(agentId));
        } else if (target === 'team' && teamId) {
            recipients = agents.filter(a => String(a.team) === String(teamId));
        } else if (target === 'allUsers') {
            const sellers = await Seller.find({ email: { $exists: true, $ne: '' } }).select('email businessName fullName');
            const customers = await User.find({ email: { $exists: true, $ne: '' } }).select('email firstName surname');
            recipients = [...agents, ...sellers, ...customers];
        } else {
            recipients = agents;
        }
        recipients = [...new Map(recipients.filter(x => x.email).map(x => [x.email.toLowerCase(), x])).values()];
        if (!recipients.length) return res.status(404).json({ message: 'No recipients found' });

        const transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: Number(process.env.EMAIL_PORT),
            secure: Number(process.env.EMAIL_PORT) === 465,
            auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
            tls: { rejectUnauthorized: false }
        });
        const html = `<div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;padding:28px;color:#1e293b">
            <h2 style="color:#2563eb">Campus Collective</h2>
            <div style="white-space:pre-wrap;line-height:1.7">${escapeHtml(message)}</div>
            <hr><small>This announcement was sent by Campus Collective Management.</small>
        </div>`;
        const results = await Promise.allSettled(recipients.map(r => transporter.sendMail({
            from: '"Campus Collective" <info@mycampuscollective.me>',
            to: r.email,
            subject,
            html
        })));
        const sent = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.length - sent;
        res.json({ message: `Announcement processed: ${sent} sent, ${failed} failed`, sent, failed, total: results.length });
    } catch (err) {
        console.error('Announcement broadcast error:', err);
        res.status(500).json({ message: 'Unable to send announcement' });
    }
});

router.get('/communication/contacts', auth, hasRole(['Admin']), async (req, res) => {
    try {
        const [agents, sellers, customers] = await Promise.all([
            Agent.find().select('fullName email phone agentId role status'),
            Seller.find().select('businessName fullName email phoneNumber phone'),
            User.find().select('firstName surname email phone')
        ]);
        res.json({
            contacts: [
                ...agents.map(a => ({ id: a._id, name: a.fullName, email: a.email, phone: a.phone, type: a.role })),
                ...sellers.map(s => ({ id: s._id, name: s.businessName || s.fullName || 'Seller', email: s.email, phone: s.phoneNumber || s.phone, type: 'Seller' })),
                ...customers.map(c => ({ id: c._id, name: `${c.firstName || ''} ${c.surname || ''}`.trim() || 'Customer', email: c.email, phone: c.phone, type: 'Customer' }))
            ]
        });
    } catch (err) {
        res.status(500).json({ message: 'Unable to load communication contacts' });
    }
});

module.exports = router;