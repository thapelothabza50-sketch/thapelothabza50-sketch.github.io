const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Agent = require('./models/Agent'); 

async function fixAdmin() {
    try {
        // --- HARDCODE YOUR URI HERE TEMPORARILY ---
        // Replace the string below with your actual MongoDB connection string
        const myConnectionString = "mongodb+srv://thapelothabza50:Mawaza%402005@campuscollective.adn68lo.mongodb.net/BonivilleShop";

        console.log("Connecting to database...");
        await mongoose.connect(myConnectionString);
        console.log("Connected!");

        const salt = await bcrypt.genSalt(10);
        const newPassword = await bcrypt.hash('Admin123!', salt); 

        // !!! Replace 'YOUR_ADMIN_ID' with your actual Agent ID/Student Number
        const adminId = '240218337@ump.ac.za'; 

        const updated = await Agent.findOneAndUpdate(
            { agentId: adminId }, 
            { password: newPassword },
            { new: true }
        );

        if (updated) {
            console.log(`Success! Password for ${adminId} has been reset.`);
            console.log("You can now login with: Admin123!");
        } else {
            console.log("Error: Could not find an account with that Agent ID in the database.");
        }

    } catch (err) {
        console.error("Database Error:", err);
    } finally {
        await mongoose.connection.close();
        process.exit();
    }
}

fixAdmin();