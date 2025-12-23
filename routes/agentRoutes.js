const express = require('express');
const router = express.Router();
const Recruit = require('../models/Recruit');
const Agent = require('../models/Agent');
const { auth, hasRole } = require('../middleware/auth');

// ==========================================
// AGENT SPECIFIC ROUTES
// ==========================================

// 1. Agent: Submit a new student recruit
router.post('/submit-recruit', auth, hasRole('Agent'), async (req, res) => {
    try {
        const { studentName, studentSurname, studentEmail, accommodation, moveInDate } = req.body;

        const newRecruit = new Recruit({
            agent: req.user.id,
            studentName,
            studentSurname,
            studentEmail,
            accommodation,
            moveInDate
        });

        await newRecruit.save();
        res.status(201).json({ message: 'Student recruitment submitted for approval!' });
    } catch (err) {
        res.status(500).json({ message: 'Server Error: Could not submit recruit.' });
    }
});

// 2. Agent: Get my stats and recruit list
router.get('/my-stats', auth, hasRole('Agent'), async (req, res) => {
    try {
        const recruits = await Recruit.find({ agent: req.user.id }).sort({ createdAt: -1 });
        const agent = await Agent.findById(req.user.id);

        // Calculate total earnings from approved recruits
        const totalEarnings = recruits
            .filter(r => r.status === 'Approved')
            .reduce((sum, r) => sum + r.commissionEarned, 0);

        res.json({
            recruits,
            totalEarnings,
            fullName: agent.fullName
        });
    } catch (err) {
        res.status(500).json({ message: 'Server Error' });
    }
});

// ==========================================
// MANAGEMENT (ADMIN) ROUTES FOR AGENTS
// ==========================================

// 3. Admin: Get ALL recruits for approval
router.get('/admin/all-recruits', auth, hasRole('Admin'), async (req, res) => {
    try {
        const recruits = await Recruit.find().populate('agent', 'fullName businessName').sort({ createdAt: -1 });
        res.json(recruits);
    } catch (err) {
        res.status(500).json({ message: 'Server Error' });
    }
});

// 4. Admin: Approve Recruit & Set Commission
router.put('/admin/approve-recruit/:id', auth, hasRole('Admin'), async (req, res) => {
    try {
        const { commissionAmount } = req.body; // Amount from your dashboard calculator
        const recruit = await Recruit.findById(req.params.id);

        if (!recruit) return res.status(404).json({ message: 'Recruit not found' });

        recruit.status = 'Approved';
        recruit.commissionEarned = commissionAmount;
        await recruit.save();

        res.json({ message: 'Recruit approved and commission updated!' });
    } catch (err) {
        res.status(500).json({ message: 'Server Error' });
    }
});

// 5. Admin: Block/Unblock Agent Account
router.put('/admin/toggle-agent-lock/:id', auth, hasRole('Admin'), async (req, res) => {
    try {
        const agent = await Agent.findById(req.params.id);
        if (!agent) return res.status(404).json({ message: 'Agent not found' });

        agent.isLocked = !agent.isLocked; // Flip the status
        await agent.save();

        res.json({ message: `Agent account ${agent.isLocked ? 'Locked' : 'Unlocked'} successfully.` });
    } catch (err) {
        res.status(500).json({ message: 'Server Error' });
    }
});

module.exports = router;const express = require('express');
const router = express.Router();
const Recruit = require('../models/Recruit');
const Agent = require('../models/Agent');
const { auth, hasRole } = require('../middleware/auth');

// ==========================================
// AGENT SPECIFIC ROUTES
// ==========================================

// 1. Agent: Submit a new student recruit
router.post('/submit-recruit', auth, hasRole('Agent'), async (req, res) => {
    try {
        const { studentName, studentSurname, studentEmail, accommodation, moveInDate } = req.body;

        const newRecruit = new Recruit({
            agent: req.user.id,
            studentName,
            studentSurname,
            studentEmail,
            accommodation,
            moveInDate
        });

        await newRecruit.save();
        res.status(201).json({ message: 'Student recruitment submitted for approval!' });
    } catch (err) {
        res.status(500).json({ message: 'Server Error: Could not submit recruit.' });
    }
});

// 2. Agent: Get my stats and recruit list
router.get('/my-stats', auth, hasRole('Agent'), async (req, res) => {
    try {
        const recruits = await Recruit.find({ agent: req.user.id }).sort({ createdAt: -1 });
        const agent = await Agent.findById(req.user.id);

        // Calculate total earnings from approved recruits
        const totalEarnings = recruits
            .filter(r => r.status === 'Approved')
            .reduce((sum, r) => sum + r.commissionEarned, 0);

        res.json({
            recruits,
            totalEarnings,
            fullName: agent.fullName
        });
    } catch (err) {
        res.status(500).json({ message: 'Server Error' });
    }
});

// ==========================================
// MANAGEMENT (ADMIN) ROUTES FOR AGENTS
// ==========================================

// 3. Admin: Get ALL recruits for approval
router.get('/admin/all-recruits', auth, hasRole('Admin'), async (req, res) => {
    try {
        const recruits = await Recruit.find().populate('agent', 'fullName businessName').sort({ createdAt: -1 });
        res.json(recruits);
    } catch (err) {
        res.status(500).json({ message: 'Server Error' });
    }
});

// 4. Admin: Approve Recruit & Set Commission
router.put('/admin/approve-recruit/:id', auth, hasRole('Admin'), async (req, res) => {
    try {
        const { commissionAmount } = req.body; // Amount from your dashboard calculator
        const recruit = await Recruit.findById(req.params.id);

        if (!recruit) return res.status(404).json({ message: 'Recruit not found' });

        recruit.status = 'Approved';
        recruit.commissionEarned = commissionAmount;
        await recruit.save();

        res.json({ message: 'Recruit approved and commission updated!' });
    } catch (err) {
        res.status(500).json({ message: 'Server Error' });
    }
});

// 5. Admin: Block/Unblock Agent Account
router.put('/admin/toggle-agent-lock/:id', auth, hasRole('Admin'), async (req, res) => {
    try {
        const agent = await Agent.findById(req.params.id);
        if (!agent) return res.status(404).json({ message: 'Agent not found' });

        agent.isLocked = !agent.isLocked; // Flip the status
        await agent.save();

        res.json({ message: `Agent account ${agent.isLocked ? 'Locked' : 'Unlocked'} successfully.` });
    } catch (err) {
        res.status(500).json({ message: 'Server Error' });
    }
});

module.exports = router;