// routes/sellerRoutes.js (FINALIZED & VERIFIED)

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose'); 

// --- CRITICAL IMPORTS ---
const Product = require('../models/Product');
const { auth, hasRole } = require('../middleware/auth'); 
const Order = require('../models/Order'); 
const multer = require('multer');   
const path = require('path');       
const fs = require('fs');           

// -------------------------------------------------------------------------
// MULTER CONFIGURATION
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
// SPECIAL EXPIRATION CHECKER AND CLEANER FUNCTION
// ------------------------------------------------------------------------
const checkAndClearSpecial = async (product) => {
    const productObj = product.toObject ? product.toObject() : product;

    if (productObj.onSpecial && productObj.specialEnd && new Date(productObj.specialEnd) < new Date()) {
        console.log(`Special for product ${productObj._id} has expired. Clearing special status.`);
        
        const newPrice = productObj.oldPrice > 0 ? productObj.oldPrice : productObj.price;
        
        await Product.findByIdAndUpdate(productObj._id, {
            price: newPrice,
            oldPrice: 0,
            onSpecial: false,
            specialEnd: null
        });
        
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


// ------------------------------------------------------------------------
// HELPER MIDDLEWARE: Check if Seller is Approved
// ------------------------------------------------------------------------
const requireApprovedAccount = async (req, res, next) => {
    try {
        const Seller = require('../models/Seller');
        const seller = await Seller.findById(req.user.id);
        
        if (!seller) {
            return res.status(404).json({ message: 'Seller profile not found.' });
        }

        if (seller.status !== 'approved') {
            return res.status(403).json({ 
                success: false, 
                message: 'Your account is currently pending admin approval. You cannot add or publish products yet.' 
            });
        }

        next();
    } catch (err) {
        console.error('Approval status check error:', err.message);
        res.status(500).json({ message: 'Server error verifying account status.' });
    }
};


// =========================================================================
// PRODUCT ROUTES (Protected by Seller Role)
// =========================================================================

// A. GET /api/seller/products - Fetch ALL products for the Logged-In Seller
router.get('/products', auth, hasRole(['Seller']), async (req, res) => {
    try {
        const sellerId = req.user.id;
        
        let products = await Product.find({ seller: sellerId })
            .select('-__v')
            .sort({ createdAt: -1 });

        const checkedProducts = await Promise.all(products.map(checkAndClearSpecial));

        res.json(checkedProducts);

    } catch (err) {
        console.error('Error fetching seller products:', err.message);
        res.status(500).send('Server Error fetching seller products.');
    }
});


// B. POST /api/seller/products/create - Create a New Product
router.post('/create', auth, requireApprovedAccount, upload.single('image'), async (req, res) => {
    try {
        const { name, description, price, stock, category, onSpecial, specialEnd, oldPrice } = req.body;
        
        const imagePath = req.file ? `/uploads/${req.file.filename}` : 'no_image.png';

        if (!name || !price || !stock || !category) {
            if (req.file && fs.existsSync(path.join(__dirname, '..', imagePath))) {
                fs.unlinkSync(path.join(__dirname, '..', imagePath));
            }
            return res.status(400).json({ message: 'Missing required product fields (name, price, stock, category).' });
        }

        const newProduct = new Product({
            seller: req.user.id,
            name,
            description,
            price: parseFloat(price),
            stock: parseInt(stock),
            category,
            image: imagePath,
            onSpecial: onSpecial === 'true',
            specialEnd: onSpecial === 'true' ? new Date(specialEnd) : null,
            oldPrice: onSpecial === 'true' ? parseFloat(oldPrice) : 0,
        });

        await newProduct.save();

        res.status(201).json(newProduct);

    } catch (err) {
        console.error('Product Creation Error:', err.message);
        if (err.name === 'ValidationError') {
            const messages = Object.values(err.errors).map(val => val.message);
            return res.status(400).json({ message: 'Mongoose Validation Failed.', errors: messages });
        }
        res.status(500).send('Server Error during product creation.');
    }
});


// C. PUT /api/seller/products/:id - Update Product
router.put('/products/:id', auth, hasRole(['Seller']), upload.single('image'), async (req, res) => {
    try {
        const productId = req.params.id;
        const updateData = req.body;
        const sellerId = req.user.id;
        let oldImagePath = null;
        
        let product = await Product.findOne({ _id: productId, seller: sellerId });

        if (!product) {
            return res.status(404).json({ message: 'Product not found or access denied.' });
        }
        
        if (req.file) {
            oldImagePath = product.image;
            updateData.image = `/uploads/${req.file.filename}`;
        }
        
        const updatedProduct = await Product.findByIdAndUpdate(
            productId, 
            { $set: updateData },
            { new: true, runValidators: true }
        );

        if (req.file && oldImagePath && oldImagePath !== 'no_image.png') {
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
        
        const product = await Product.findOneAndDelete({ _id: productId, seller: sellerId });

        if (!product) {
            return res.status(404).json({ message: 'Product not found or access denied.' });
        }

        if (product.image && product.image !== 'no_image.png') {
            const fullPath = path.join(__dirname, '..', product.image);
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

module.exports = router;