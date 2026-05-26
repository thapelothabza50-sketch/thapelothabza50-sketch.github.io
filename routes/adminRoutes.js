const express = require('express');
const router = express.Router();
const { auth, hasRole } = require('../middleware/auth'); 
const Seller = require('../models/Seller');
const Agent = require('../models/Agent'); 
const Recruit = require('../models/Recruit');
const Season = require('../models/Season');

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
        if (req.user.role !== 'Admin') {
            filter = { agent: req.user.id };
        }
        const recruits = await Recruit.find(filter).sort({ createdAt: -1 });
        res.json(recruits);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching recruits' });
    }
});

// --- TOGGLE LOCK ---
router.post('/toggle-lock', auth, hasRole(['Admin']), async (req, res) => {
    const { userId, status } = req.body;
    try {
        let user = await Seller.findByIdAndUpdate(userId, { status }, { new: true });
        if (!user) {
            user = await Agent.findByIdAndUpdate(userId, { status }, { new: true });
        }
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json({ message: `Account successfully ${status}`, userStatus: user.status });
    } catch (err) {
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
            { status: 'archived' },
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
router.get('/dashboard/recruits', auth, hasRole(['Admin']), async (req, res) => {
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

module.exports = router;