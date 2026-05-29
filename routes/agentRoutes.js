const express = require('express');
const router = express.Router();
const { auth, hasRole } = require('../middleware/auth');
const Agent = require('../models/Agent');
const Recruit = require('../models/Recruit');
const Season = require('../models/Season');

// ========================================================================
// 🏆 AGENT RECRUIT MANAGEMENT (SEASONAL)
// ========================================================================

/**
 * @route   GET /api/agent/current-season
 * @desc    Get current active recruitment season
 * @access  Private (Agents)
 */
router.get('/current-season', auth, hasRole(['Agent']), async (req, res) => {
    try {
        const activeSeason = await Season.findOne({ isActive: true });
        if (!activeSeason) {
            return res.status(404).json({ message: 'No active recruitment season' });
        }
        res.json(activeSeason);
    } catch (err) {
        console.error('Error fetching season:', err.message);
        res.status(500).json({ message: 'Error fetching season' });
    }
});

/**
 * @route   POST /api/agent/submit-recruit
 * @desc    Add a new recruit to current season
 * @access  Private (Agents)
 */
router.post('/submit-recruit', auth, hasRole(['Agent']), async (req, res) => {
    try {
        const { studentName, studentSurname, studentEmail, studentPhone, accommodation, moveInDate } = req.body;

        const activeSeason = await Season.findOne({ isActive: true });
        if (!activeSeason) {
            return res.status(400).json({ message: 'No active recruitment season. Contact admin.' });
        }

        if (!studentName || !studentSurname || !studentEmail || !studentPhone || !accommodation || !moveInDate) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        const newRecruit = new Recruit({
            studentName,
            studentSurname,
            studentEmail,
            studentPhone,
            accommodation,
            moveInDate,
            agent: req.user.id,
            agentId: req.user.agentId || '',
            season: activeSeason._id,
            seasonName: activeSeason.name,
            status: 'Pending',
            commissionEarned: 0
        });

        await newRecruit.save();

        await Season.findByIdAndUpdate(activeSeason._id, {
            $inc: { totalRecruits: 1, pendingRecruits: 1 }
        });

        res.status(201).json({
            message: `Recruit added successfully to ${activeSeason.name}`,
            recruit: newRecruit,
            season: activeSeason
        });
    } catch (err) {
        console.error('Submit Recruit Error:', err.message);
        res.status(500).json({ message: 'Server error: ' + err.message });
    }
});

/**
 * @route   GET /api/agent/my-recruits
 * @desc    Get recruits for this agent and season
 * @access  Private (Agents)
 */
router.get('/my-recruits', auth, hasRole(['Agent']), async (req, res) => {
    try {
        const activeSeason = await Season.findOne({ isActive: true });
        const { seasonId } = req.query;

        const filter = { agent: req.user.id };
        let seasonToReturn = activeSeason;

        if (seasonId) {
            filter.season = seasonId;
            seasonToReturn = await Season.findById(seasonId);
        } else if (activeSeason) {
            filter.season = activeSeason._id;
        }

        const recruits = await Recruit.find(filter)
            .populate('season', 'name semester year status')
            .sort({ createdAt: -1 });

        res.json({
            currentSeason: seasonToReturn,
            recruits,
            count: recruits.length,
            filter: seasonId ? `Season ID: ${seasonId}` : 'Current Season Only'
        });
    } catch (err) {
        console.error('Error fetching recruits:', err.message);
        res.status(500).json({ message: 'Error fetching recruits' });
    }
});

/**
 * @route   GET /api/agent/my-recruits/all
 * @desc    Get all recruits for this agent across seasons
 * @access  Private (Agents)
 */
router.get('/my-recruits/all', auth, hasRole(['Agent']), async (req, res) => {
    try {
        const recruits = await Recruit.find({ agent: req.user.id })
            .populate('season', 'name semester year status isActive')
            .sort({ createdAt: -1 });

        const grouped = {};
        recruits.forEach(recruit => {
            const seasonName = recruit.season?.name || 'Unknown Season';
            if (!grouped[seasonName]) {
                grouped[seasonName] = { season: recruit.season, recruits: [] };
            }
            grouped[seasonName].recruits.push(recruit);
        });

        res.json({
            allRecruits: recruits,
            count: recruits.length,
            groupedBySeason: grouped
        });
    } catch (err) {
        console.error('Error fetching all recruits:', err.message);
        res.status(500).json({ message: 'Error fetching recruits' });
    }
});

/**
 * @route   GET /api/agent/recruit-stats
 * @desc    Get recruitment statistics for this agent
 * @access  Private (Agents)
 */
router.get('/recruit-stats', auth, hasRole(['Agent']), async (req, res) => {
    try {
        const allRecruits = await Recruit.find({ agent: req.user.id })
            .populate('season', 'name isActive');

        const currentSeasonRecruits = allRecruits.filter(r => r.season?.isActive);
        const stats = {
            totalAllTime: allRecruits.length,
            currentSeason: currentSeasonRecruits.length,
            approved: allRecruits.filter(r => r.status === 'Approved').length,
            pending: allRecruits.filter(r => r.status === 'Pending').length,
            cancelled: allRecruits.filter(r => r.status === 'Cancelled').length,
            totalCommissionsEarned: allRecruits.reduce((sum, r) => sum + (r.commissionEarned || 0), 0),
            totalPaidOut: allRecruits.filter(r => r.isPaid).reduce((sum, r) => sum + (r.commissionEarned || 0), 0)
        };

        res.json(stats);
    } catch (err) {
        console.error('Error calculating stats:', err.message);
        res.status(500).json({ message: 'Error calculating statistics' });
    }
});

/**
 * @route   GET /api/agent/all-seasons
 * @desc    Get all seasons with this agent's counts
 * @access  Private (Agents)
 */
router.get('/all-seasons', auth, hasRole(['Agent']), async (req, res) => {
    try {
        const seasons = await Season.find().sort({ year: -1, semester: -1 });
        const seasonsWithCounts = [];

        for (const season of seasons) {
            const recruitCount = await Recruit.countDocuments({ agent: req.user.id, season: season._id });
            seasonsWithCounts.push({ ...season.toObject(), myRecruitCount: recruitCount });
        }

        res.json(seasonsWithCounts);
    } catch (err) {
        console.error('Error fetching seasons:', err.message);
        res.status(500).json({ message: 'Error fetching seasons' });
    }
});

/**
 * @route   GET /api/agent/profile
 * @desc    Get agent profile with banking details
 * @access  Private (Agents)
 */
router.get('/profile', auth, hasRole(['Agent']), async (req, res) => {
    try {
        const agent = await Agent.findById(req.user.id).select('-password');
        if (!agent) return res.status(404).json({ message: 'Agent not found' });
        res.json(agent);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching profile' });
    }
});

/**
 * @route   PUT /api/agent/update-banking
 * @desc    Update agent banking details
 * @access  Private (Agents)
 */
router.put('/update-banking', auth, hasRole(['Agent']), async (req, res) => {
    try {
        const { banking } = req.body;
        const agent = await Agent.findByIdAndUpdate(req.user.id, { $set: { banking } }, { new: true }).select('-password');
        if (!agent) return res.status(404).json({ message: 'Agent not found' });
        res.json({ message: 'Banking details updated successfully', agent });
    } catch (err) {
        console.error('Banking Update Error:', err.message);
        res.status(500).json({ message: 'Server error: ' + err.message });
    }
});

module.exports = router;
