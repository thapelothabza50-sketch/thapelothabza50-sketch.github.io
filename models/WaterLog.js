const mongoose = require('mongoose');

const WaterLogSchema = new mongoose.Schema({
    date: { type: Date, required: true },
    truckQuantity: { type: Number, required: true }, 
    // pricePerUnit removed or made optional because it's not sent by the route
    totalCost: { type: Number, required: true },
    month: { type: String, required: true }, 
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('WaterLog', WaterLogSchema);