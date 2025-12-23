const express = require('express');
const cors = require('cors'); 
const connectDB = require('./db'); 
const path = require('path'); 
require('dotenv').config();

// Route Imports
const authRoutes = require('./routes/authRoutes.js'); 
const adminRoutes = require('./routes/adminRoutes.js'); // 🏆 ADDED THIS
const sellerRoutes = require('./routes/sellerRoutes.js'); 
const sellerOrderRoutes = require('./routes/sellerOrderRoutes.js'); 
const shopRoutes = require('./routes/shopRoutes.js'); 
const orderRoutes = require('./routes/orderRoutes.js'); 

const app = express(); 
const PORT = process.env.PORT || 8080;

// Middlewares
app.use(cors()); 
app.use(express.json()); 

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes
app.use('/api/auth', authRoutes);         
app.use('/api/admin', adminRoutes); // 🏆 ADDED THIS: Matches management.html logic
app.use('/api/seller', sellerRoutes);     
app.use('/api/seller/orders', sellerOrderRoutes); 
app.use('/api/shop', shopRoutes);         
app.use('/api/orders', orderRoutes);      

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'home.html'));
});

const startServer = async () => {
    try {
        await connectDB(); 
        app.listen(PORT, () => {
            console.log(`✅ Campus Collective running at http://localhost:${PORT}`);
        });
    } catch (err) {
        console.error('❌ Server start failed:', err);
    }
};
// server.js - Automated Tasks
const cron = require('node-cron');
const Seller = require('./models/Seller');

// Run every night at 00:00
cron.schedule('0 0 * * *', async () => {
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    
    try {
        const inactiveSellers = await Seller.find({ 
            lastActive: { $lt: sixtyDaysAgo }, 
            status: 'active' 
        });

        for (let seller of inactiveSellers) {
            seller.status = 'locked';
            seller.deactivationReason = 'Automatic lock due to 60 days of inactivity.';
            seller.reactivationFeeOwed = 150; // You can change this amount
            await seller.save();
            console.log(`[SECURITY] Locked inactive seller: ${seller.email}`);
        }
    } catch (err) {
        console.error('Error in auto-lock task:', err);
    }
});
startServer();