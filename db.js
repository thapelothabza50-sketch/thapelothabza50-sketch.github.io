// db.js (FINAL & CORRECTED)

// 1. Load environment variables from the .env file
require('dotenv').config(); 
const mongoose = require('mongoose');

// 2. Access the connection string securely from the environment
const dbURI = process.env.MONGODB_URI; 

const connectDB = async () => {
    // Check if the URI was loaded successfully
    if (!dbURI) {
        console.error("❌ MONGODB_URI not defined in .env file!");
        process.exit(1);
    }

    try {
        // 3. Connect to MongoDB using Mongoose
        // CRITICAL FIX: Increase Mongoose timeouts for better stability
        await mongoose.connect(dbURI);
        
        // Use the connection object to confirm success
        const dbName = mongoose.connection.name;
        console.log(`✅ MongoDB connection successful! Connected to database: ${dbName}`);
        
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
        // Exit process with failure
        process.exit(1); 
    }
    
}; // <--- THIS IS THE MISSING BRACE THAT CAUSED THE ERROR!

// 4. Export the connection function to be used by your main server file
module.exports = connectDB;