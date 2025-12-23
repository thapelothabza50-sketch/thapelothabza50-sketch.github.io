// routes/shopRoutes.js (FINAL FIXED VERSION)
const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const mongoose = require('mongoose');

// -------------------------------------------------------------------------
// SPECIAL EXPIRATION CHECKER AND CLEANER FUNCTION 
// CRITICAL: This updates the database to clear expired specials when viewed.
// -------------------------------------------------------------------------
const checkAndClearSpecial = async (product) => {
    const productObj = product.toObject ? product.toObject() : product; 

    // Check if specialEnd date has passed
    if (productObj.onSpecial && productObj.specialEnd && new Date(productObj.specialEnd) < new Date()) {
        
        // Determine the price to revert to. Fallback to current price if oldPrice is zero/missing.
        const newPrice = productObj.oldPrice > 0 ? productObj.oldPrice : productObj.price;
        
        // Update local object
        productObj.price = newPrice; 
        productObj.onSpecial = false;
        productObj.oldPrice = 0;
        productObj.specialEnd = null;

        // CRITICAL: Update the database
        await Product.updateOne({ _id: productObj._id }, {
            $set: {
                price: productObj.price,
                onSpecial: productObj.onSpecial,
                oldPrice: productObj.oldPrice,
                specialEnd: productObj.specialEnd
            }
        });
    }
    return productObj;
};

// -------------------------------------------------------------------------
// PUBLIC ROUTES
// -------------------------------------------------------------------------

// A. 🛒 GET All Products (Public, Unsecured)
// GET /api/shop/products/
router.get('/products', async (req, res) => { 
    try {
        // Fetch all products with stock > 0
        const products = await Product.find({ stock: { $gt: 0 } }) 
            .select('-__v')
            // Populate the seller's business name for display
            .populate('seller', 'businessName email')
            .lean(); // Use .lean() for faster query

        // Apply expiration check to all in-stock products
        const checkedProducts = await Promise.all(products.map(product => checkAndClearSpecial(product)));

        res.json(checkedProducts);
    } catch (err) {
        console.error("Shop Fetch All Error:", err.message);
        res.status(500).json({ message: 'Server Error fetching products.' });
    }
});

// B. 🛒 GET Single Product by ID (Public, Unsecured)
// GET /api/shop/products/:id
router.get('/products/:id', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid Product ID format.' });
        }
        
        let product = await Product.findById(req.params.id)
            .select('-__v')
            // FIX: Populate 'businessName' instead of 'username'
            .populate('seller', 'businessName email')
            .lean(); 

        if (!product) {
            return res.status(404).json({ message: 'Product not found.' });
        }

        // Apply expiration check
        const checkedProduct = await checkAndClearSpecial(product);
        
        // Check stock
        if (checkedProduct.stock <= 0) {
            // Treat out-of-stock products as "not found" to prevent direct access
            return res.status(404).json({ message: 'Product not found or currently out of stock.' });
        }

        res.json(checkedProduct);
    } catch (err) {
        console.error("Shop Fetch Single Error:", err.message);
        // Handle potential Mongoose casting errors
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'Invalid Product ID format.' });
        }
        res.status(500).send('Server Error fetching product details.');
    }
});

module.exports = router;