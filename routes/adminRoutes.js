const express = require('express');
const router = express.Router();
const { auth, hasRole } = require('../middleware/auth'); 
const Seller = require('../models/Seller');
const Agent = require('../models/Agent'); 
const Recruit = require('../models/Recruit');

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
router.post('/approve-recruit/:id', auth, hasRole(['Admin']), async (req, res) => {
    try {
        const { commissionAmount } = req.body; 
        
        const recruit = await Recruit.findById(req.params.id);
        if (!recruit) return res.status(404).json({ message: 'Recruit not found' });

        recruit.status = 'Approved';
        recruit.commissionEarned = parseFloat(commissionAmount) || 0; 
        
        await recruit.save();

        res.json({ message: 'Student approved and commission set!', recruit });
    } catch (err) {
        console.error('Approval Error:', err.message);
        res.status(500).send('Server Error during approval');
    }
});

module.exports = router;