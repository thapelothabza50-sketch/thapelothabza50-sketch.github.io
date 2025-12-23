// models/Product.js (FULL VERSION)
const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
    seller: { 
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Seller', 
        required: true,
    },
    name: {
        type: String,
        required: true,
        trim: true,
    },
    description: {
        type: String,
        required: true,
    },
    price: {
        type: Number,
        required: true,
        min: 0.01,
    },
    stock: {
        type: Number,
        required: true,
        min: 0,
        default: 0,
    },
    category: { 
        type: String,
        enum: [
            'TEXTBOOK', 
            'ELECTRONICS',
            'Food',      
            'Cloths',   
            'SERVICES', 
            'OTHER'
        ], 
        required: true,
        default: 'OTHER',
    },
    onSpecial: {
        type: Boolean,
        default: false,
    },
    oldPrice: {
        type: Number,
        default: 0, 
    },
    specialEnd: {
        type: Date,
        default: null 
    },
    image: {
        type: String,
        default: 'no_image.png',
        required: true,
    },
}, { timestamps: true }); 

module.exports = mongoose.model('Product', ProductSchema);