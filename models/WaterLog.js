const mongoose = require('mongoose');

const WaterLogSchema = new mongoose.Schema({
    date: { type: Date, required: true },
    truckQuantity: { type: Number, required: true }, // e.g., in Liters or Units
    pricePerTruck: { type: Number, required: true },
    totalCost: { type: Number, required: true },
    month: { type: String, required: true }, // Format: "YYYY-MM" for easy grouping
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('WaterLog', WaterLogSchema);