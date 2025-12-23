// routes/sellerRoutes.js (FINALIZED & VERIFIED)

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose'); 

// --- CRITICAL IMPORTS ---
const Product = require('../models/Product');
const { auth, hasRole } = require('../middleware/auth'); // NEW IMPORT
const Order = require('../models/Order'); // Used for the special checker
const multer = require('multer');   
const path = require('path');       
const fs = require('fs');           

// -------------------------------------------------------------------------
// MULTER CONFIGURATION (Your existing setup for file uploads)
// -------------------------------------------------------------------------
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '..', 'uploads');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname)); 
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 1024 * 1024 * 5 }, // 5MB limit
});


// ------------------------------------------------------------------------
// NEW: SPECIAL EXPIRATION CHECKER AND CLEANER FUNCTION (Called on GET routes)
// ------------------------------------------------------------------------
const checkAndClearSpecial = async (product) => {
    // If the product is a Mongoose document, convert it for modification in memory
    const productObj = product.toObject ? product.toObject() : product;

    // Check if the product is marked as on special and has an end date in the past
    if (productObj.onSpecial && productObj.specialEnd && new Date(productObj.specialEnd) < new Date()) {
        console.log(`Special for product ${productObj._id} has expired. Clearing special status.`);
        
        // CRITICAL: Revert price to oldPrice or keep current price if oldPrice is 0
        const newPrice = productObj.oldPrice > 0 ? productObj.oldPrice : productObj.price;
        
        await Product.findByIdAndUpdate(productObj._id, {
            price: newPrice, // Restore price
            oldPrice: 0,
            onSpecial: false,
            specialEnd: null
        });
        
        // Return the updated, non-special product object
        return { 
            ...productObj,
            price: newPrice,
            oldPrice: 0,
            onSpecial: false,
            specialEnd: null
        };
    }
    return productObj;
};


// =========================================================================
// PRODUCT ROUTES (Protected by Seller Role)
// =========================================================================

// A. GET /api/seller/products - Fetch ALL products for the Logged-In Seller
// 🏆 FIXES 404 ERROR
router.get('/products', auth, hasRole(['Seller']), async (req, res) => {
    try {
        const sellerId = req.user.id;
        
        // Find all products where the seller field matches the logged-in user's ID
        let products = await Product.find({ seller: sellerId })
            .select('-__v')
            .sort({ createdAt: -1 });

        // Apply special checker to each product
        const checkedProducts = await Promise.all(products.map(checkAndClearSpecial));

        res.json(checkedProducts);

    } catch (err) {
        console.error('Error fetching seller products:', err.message);
        res.status(500).send('Server Error fetching seller products.');
    }
});


// B. POST /api/seller/products - Create a New Product (with optional image upload)
router.post('/products', auth, hasRole(['Seller']), upload.single('image'), async (req, res) => {
    try {
        const { name, description, price, stock, category, onSpecial, specialEnd, oldPrice } = req.body;
        
        // Check if an image was uploaded
        const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

        // Basic validation
        if (!name || !price || !stock || !category) {
            // Clean up the uploaded file if validation fails
            if (imageUrl && fs.existsSync(path.join(__dirname, '..', imageUrl))) {
                fs.unlinkSync(path.join(__dirname, '..', imageUrl));
            }
            return res.status(400).json({ message: 'Missing required product fields (name, price, stock, category).' });
        }

        const newProduct = new Product({
            seller: req.user.id, // Associate product with the logged-in seller
            name,
            description,
            price: parseFloat(price),
            stock: parseInt(stock),
            category,
            imageUrl, 
            onSpecial: onSpecial === 'true', // Convert string to boolean
            specialEnd: onSpecial === 'true' ? new Date(specialEnd) : null,
            oldPrice: onSpecial === 'true' ? parseFloat(oldPrice) : 0,
        });

        await newProduct.save();

        res.status(201).json(newProduct);

    } catch (err) {
        console.error('Product Creation Error:', err.message);
        // More specific validation for Mongoose errors
        if (err.name === 'ValidationError') {
            const messages = Object.values(err.errors).map(val => val.message);
            return res.status(400).json({ message: 'Mongoose Validation Failed.', errors: messages });
        }
        res.status(500).send('Server Error during product creation.');
    }
});


// C. PUT /api/seller/products/:id - Update Product
router.put('/products/:id', auth, hasRole(['Seller']), upload.single('image'), async (req, res) => {
    // ... (Your update product logic remains here) ...
    // Note: The logic for updating an order is in sellerOrderRoutes.js, 
    // but the original snippet showed product update logic here, so I'll keep the standard route structure.
    try {
        const productId = req.params.id;
        const updateData = req.body;
        const sellerId = req.user.id;
        let oldImagePath = null;
        
        // 1. Find the product and ensure it belongs to the seller
        let product = await Product.findOne({ _id: productId, seller: sellerId });

        if (!product) {
            return res.status(404).json({ message: 'Product not found or access denied.' });
        }
        
        // 2. Handle Image Update
        if (req.file) {
            // Save old image path to delete later
            oldImagePath = product.imageUrl; 
            updateData.imageUrl = `/uploads/${req.file.filename}`;
        }
        
        // 3. Update the document
        // CRITICAL: We use findByIdAndUpdate without the security check again, but the findOne above served that purpose
        const updatedProduct = await Product.findByIdAndUpdate(
            productId, 
            { $set: updateData },
            { new: true, runValidators: true }
        );

        // 4. Clean up old image if a new one was uploaded
        if (req.file && oldImagePath) {
            const fullPath = path.join(__dirname, '..', oldImagePath);
            if (fs.existsSync(fullPath)) {
                fs.unlinkSync(fullPath);
            }
        }

        res.json(updatedProduct);

    } catch (err) {
        console.error('Product Update Error:', err.message);
        res.status(500).send('Server Error during product update.');
    }
});


// D. DELETE /api/seller/products/:id - Delete Product
router.delete('/products/:id', auth, hasRole(['Seller']), async (req, res) => {
    try {
        const productId = req.params.id;
        const sellerId = req.user.id;
        
        // Find and delete the product, ensuring it belongs to the seller
        const product = await Product.findOneAndDelete({ _id: productId, seller: sellerId });

        if (!product) {
            return res.status(404).json({ message: 'Product not found or access denied.' });
        }

        // Clean up the image file from the server
        if (product.imageUrl) {
            const fullPath = path.join(__dirname, '..', product.imageUrl);
            if (fs.existsSync(fullPath)) {
                fs.unlinkSync(fullPath);
            }
        }

        res.json({ message: 'Product deleted successfully.' });

    } catch (err) {
        console.error('Product Deletion Error:', err.message);
        res.status(500).send('Server Error during product deletion.');
    }
});


// =========================================================================
// ORDER ROUTES (Defined in sellerOrderRoutes.js, but kept here for completeness)
// =========================================================================

// Note: Order-related routes (GET all, GET by ID, PUT status) should be mounted
// in server.js under a different base path to prevent confusion, 
// or should use a different path here (e.g., /products/:id/orders). 
// Based on your setup, they are correctly handled in sellerOrderRoutes.js.

module.exports = router;