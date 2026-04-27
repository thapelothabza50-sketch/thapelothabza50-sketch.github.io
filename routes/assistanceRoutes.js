const express = require('express');
const router = express.Router();
const Assistance = require('../models/Assistance');
const nodemailer = require('nodemailer');

// Handle the form submission
router.post('/submit-assistance', async (req, res) => {
    try {
        // 1. Save to Database so it shows up in your Tracker
        const newApplication = new Assistance(req.body);
        const savedApp = await newApplication.save();

        // 2. Setup the Email Transporter
        // Use the same credentials you used in your authRoutes.js
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER, 
                pass: process.env.EMAIL_PASS
            }
        });

        // 3. Create the Tabulated HTML Email
        const emailContent = `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 700px; margin: auto; border: 1px solid #e0e0e0; border-radius: 10px; overflow: hidden;">
                <div style="background-color: #004a99; color: white; padding: 25px; text-align: center;">
                    <h1 style="margin: 0; font-size: 24px;">New Assisted Application</h1>
                    <p style="margin: 5px 0 0 0; opacity: 0.8;">Campus Collective Portal</p>
                </div>
                
                <div style="padding: 30px; background-color: #ffffff;">
                    <h3 style="color: #004a99; border-bottom: 2px solid #ff6600; padding-bottom: 5px;">Applicant Details</h3>
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                        <tr><td style="padding: 10px; border-bottom: 1px solid #eee; width: 40%;"><b>Full Name:</b></td><td style="padding: 10px; border-bottom: 1px solid #eee;">${req.body.First_Names} ${req.body.Surname}</td></tr>
                        <tr><td style="padding: 10px; border-bottom: 1px solid #eee;"><b>ID Number:</b></td><td style="padding: 10px; border-bottom: 1px solid #eee;">${req.body.ID_Number}</td></tr>
                        <tr><td style="padding: 10px; border-bottom: 1px solid #eee;"><b>Phone:</b></td><td style="padding: 10px; border-bottom: 1px solid #eee;">${req.body.Phone}</td></tr>
                        <tr><td style="padding: 10px; border-bottom: 1px solid #eee;"><b>First Time Applicant:</b></td><td style="padding: 10px; border-bottom: 1px solid #eee;">${req.body.First_Time_Applicant}</td></tr>
                        ${req.body.Returning_Student_Details ? `<tr><td style="padding: 10px; border-bottom: 1px solid #eee; color: #b75300;"><b>Returning Details:</b></td><td style="padding: 10px; border-bottom: 1px solid #eee;">${req.body.Returning_Student_Details}</td></tr>` : ''}
                    </table>

                    <h3 style="color: #004a99; border-bottom: 2px solid #ff6600; padding-bottom: 5px;">Next of Kin</h3>
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                        <tr><td style="padding: 10px; border-bottom: 1px solid #eee; width: 40%;"><b>NOK Name:</b></td><td style="padding: 10px; border-bottom: 1px solid #eee;">${req.body.NOK_First_Names} ${req.body.NOK_Surname}</td></tr>
                        <tr><td style="padding: 10px; border-bottom: 1px solid #eee;"><b>Relationship:</b></td><td style="padding: 10px; border-bottom: 1px solid #eee;">${req.body.NOK_Relationship}</td></tr>
                        <tr><td style="padding: 10px; border-bottom: 1px solid #eee;"><b>NOK Phone:</b></td><td style="padding: 10px; border-bottom: 1px solid #eee;">${req.body.NOK_Phone}</td></tr>
                        <tr><td style="padding: 10px; border-bottom: 1px solid #eee;"><b>NOK Email:</b></td><td style="padding: 10px; border-bottom: 1px solid #eee;">${req.body.NOK_Email || 'N/A'}</td></tr>
                    </table>

                    <h3 style="color: #004a99; border-bottom: 2px solid #ff6600; padding-bottom: 5px;">Choices</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr><td style="padding: 10px; border-bottom: 1px solid #eee;"><b>Qual Choice 1:</b></td><td style="padding: 10px; border-bottom: 1px solid #eee;">${req.body.Qual_1}</td></tr>
                    </table>
                </div>

                <div style="background-color: #f9f9f9; padding: 20px; text-align: center; color: #666; font-size: 12px;">
                    This is an automated notification from the Campus Collective Admin System.
                </div>
            </div>
        `;

        // 4. Send the Email
        await transporter.sendMail({
            from: `"Portal Assistant" <${process.env.EMAIL_USER}>`,
            to: 'info@mycampuscollective.me',
            subject: `New Application: ${req.body.First_Names} ${req.body.Surname}`,
            html: emailContent
        });

        res.status(201).json({ success: true, message: "Application processed and email sent!" });

    } catch (error) {
        console.error("Assistance Route Error:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
});

module.exports = router;