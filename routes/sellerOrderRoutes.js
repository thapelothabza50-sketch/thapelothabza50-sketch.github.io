// routes/sellerOrderRoutes.js (FINALIZED & VERIFIED)

const express = require('express');
const router = express.Router();

// 🏆 CRITICAL FIX: Use object destructuring to correctly import BOTH functions
const { auth, hasRole } = require('../middleware/auth'); 

const Order = require('../models/Order');
const mongoose = require('mongoose'); 

// =========================================================================
// Routes are now protected by auth AND hasRole(['Seller'])
// =========================================================================

// A. GET /api/seller/orders/ - Fetch ALL Orders for the Logged-In Seller
router.get('/', auth, hasRole(['Seller']), async (req, res) => {
    try {
        const sellerId = req.user.id; 

        // Find orders where ANY item's 'seller' field matches the logged-in sellerId
        const orders = await Order.find({ 
            'items.seller': new mongoose.Types.ObjectId(sellerId) 
        })
        .sort({ orderDate: -1 })
        .select('-__v'); 

        res.json(orders);
    } catch (err) {
        console.error('Error fetching seller orders:', err.message);
        res.status(500).send('Server Error fetching seller orders.');
    }
});


// B. GET /api/seller/orders/:id - Fetch SINGLE Order Details 
router.get('/:id', auth, hasRole(['Seller']), async (req, res) => {
    try {
        const orderId = req.params.id;
        const sellerId = req.user.id;

        // Find the order and ensure it contains an item sold by the logged-in seller
        const order = await Order.findOne({ 
            _id: orderId,
            'items.seller': new mongoose.Types.ObjectId(sellerId) // Security check
        })
        .select('-__v');

        if (!order) {
            return res.status(404).json({ message: 'Order not found or access denied.' });
        }

        res.json(order);

    } catch (err) {
        console.error('Error fetching single order details:', err.message);
        res.status(500).json({ message: 'Server Error fetching order details.' });
    }
});


// C. PUT /api/seller/orders/:id - Update Order Status
router.put('/:id', auth, hasRole(['Seller']), async (req, res) => {
    try {
        const orderId = req.params.id;
        const sellerId = req.user.id;
        const { status, trackingNumber } = req.body;

        if (!status) {
            return res.status(400).json({ message: 'Status field is required.' });
        }

        // Use findOne to apply the security check
        const order = await Order.findOne({ 
            _id: orderId,
            'items.seller': new mongoose.Types.ObjectId(sellerId) 
        });
        
        if (!order) {
            return res.status(404).json({ message: 'Order not found or access denied.' });
        }

        // Apply Status Update
        order.status = status;
        
        // Update tracking number only if status is Shipped
        if (trackingNumber && status === 'Shipped') {
            order.trackingNumber = trackingNumber;
        } else if (status !== 'Shipped') {
            // Clear tracking number if status is rolled back or not Shipped
            order.trackingNumber = null;
        }

        await order.save();
        res.json({ message: 'Order updated successfully', order });

    } catch (err) {
        console.error('Error updating order:', err.message);
        res.status(500).json({ message: 'Server Error updating order status.' });
    }
});


module.exports = router;