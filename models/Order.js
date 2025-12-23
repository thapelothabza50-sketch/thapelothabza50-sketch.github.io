// models/Order.js
const mongoose = require('mongoose');

const OrderItemSchema = new mongoose.Schema({
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', required: true },
});

const OrderSchema = new mongoose.Schema({
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: [OrderItemSchema],
    totalAmount: { type: Number, required: true, min: 0.01 },
    shippingDetails: {
        name: { type: String, required: true },
        email: { type: String, required: true },
        phone: { type: String },
        address: { type: String, required: true },
        city: { type: String, required: true },
    },
    orderDate: { type: Date, default: Date.now },
    status: {
        type: String,
        required: true,
        enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'],
        default: 'Pending',
    },

    // 🏆 UPDATES ADDED BELOW
    escrowStatus: {
        type: String,
        enum: ['Held', 'Released', 'Refunded'],
        default: 'Held'
    },
    paymentId: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Order', OrderSchema);