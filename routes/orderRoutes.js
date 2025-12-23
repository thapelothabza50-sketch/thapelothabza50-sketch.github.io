// routes/orderRoutes.js (FINALIZED with Role-Based Security)

const express = require('express');
const router = express.Router();
// ➡️ CRITICAL: Import the new hasRole middleware
const { auth, hasRole } = require('../middleware/auth'); 
const Order = require('../models/Order');
const Product = require('../models/Product'); 
const mongoose = require('mongoose'); 

// --- CONSTANTS ---
const SHIPPING_FEE = 50.00;
const TAX_RATE = 0.08; 
// -----------------


// =========================================================================
// 0. POST /api/orders - CREATE A NEW ORDER (Customer Checkout)
// =========================================================================

// ONLY a logged-in user with the 'Customer' role can place an order
router.post('/', auth, hasRole(['Customer']), async (req, res) => { 
    
    const customerId = req.user.id; 
    const { items, shippingDetails, totalAmount } = req.body;

    if (!items || items.length === 0) {
        return res.status(400).json({ message: 'Cart is empty. Cannot place an order.' });
    }

    try {
        let finalOrderItems = [];
        let subtotalCheck = 0; 
        let productsToUpdate = [];

        // 1. STOCK, PRICE, and SELLER VALIDATION LOOP
        for (const item of items) {
            // Validate product ID format
            if (!mongoose.Types.ObjectId.isValid(item.product)) {
                return res.status(400).json({ message: `Invalid product ID format: ${item.product}` });
            }

            const productDoc = await Product.findById(item.product);
            
            if (!productDoc) {
                return res.status(404).json({ message: `Product with ID ${item.product} not found.` });
            }

            if (productDoc.stock < item.quantity) {
                return res.status(400).json({ message: `Insufficient stock for product ${productDoc.name}. Available: ${productDoc.stock}` });
            }

            // Price validation (Use the current price from the database)
            const expectedPrice = productDoc.price;

            // Calculate item total for server-side validation
            const itemTotal = expectedPrice * item.quantity;
            subtotalCheck += itemTotal;

            // Prepare the final item object to be stored
            finalOrderItems.push({
                product: productDoc._id,
                name: productDoc.name,
                image: productDoc.image, 
                quantity: item.quantity,
                price: expectedPrice, // CRITICAL: This satisfies the Mongoose schema
                seller: productDoc.seller, // CRITICAL: Store the seller's ID
            });
            
            // Collect products to update stock later
            productsToUpdate.push({ id: productDoc._id, quantity: item.quantity });
        }
        
        // 2. FINAL TOTAL CHECK 
        const taxCheck = subtotalCheck * TAX_RATE;
        const grandTotalCheck = subtotalCheck + SHIPPING_FEE + taxCheck; 
        
        // 3. CREATE THE ORDER
        const newOrder = new Order({
            customer: customerId, // Populated from JWT token
            items: finalOrderItems, 
            shippingDetails: shippingDetails,
            totalAmount: grandTotalCheck,
            status: 'Pending',
        });

        await newOrder.save(); 
        
        // 4. DEDUCT STOCK
        for (const item of productsToUpdate) {
            await Product.findByIdAndUpdate(item.id, {
                $inc: { stock: -item.quantity } 
            });
        }

        res.status(201).json(newOrder);

    } catch (err) {
        console.error('Order Creation Error:', err.message);
        
        if (err.name === 'ValidationError') {
            const messages = Object.values(err.errors).map(val => val.message);
            return res.status(400).json({ 
                message: 'Mongoose Validation Failed. Check required fields or item data.', 
                errors: messages 
            });
        }
        
        res.status(500).json({ message: 'Server Error during order creation.' });
    }
});


// =========================================================================
// 1. GET ALL ORDERS FOR THE CUSTOMER (USED FOR TRACKING)
// GET /api/orders/me 
// =========================================================================

// ONLY a logged-in user with the 'Customer' role can view their orders
router.get('/me', auth, hasRole(['Customer']), async (req, res) => {
    try {
        // Find orders where the 'customer' field matches the logged-in user's ID
        const orders = await Order.find({ customer: req.user.id }) 
            // Sort by the latest order date first
            .sort({ orderDate: -1 }) 
            .select('-__v'); 

        res.json(orders);

    } catch (err) {
        console.error('Error fetching customer orders:', err.message);
        res.status(500).send('Server Error fetching orders.');
    }
});


module.exports = router;