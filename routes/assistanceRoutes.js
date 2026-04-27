const express = require('express');
const router = express.Router();
const Assistance = require('../models/Assistance');
const nodemailer = require('nodemailer');

router.post('/submit-assistance', async (req, res) => {
    try {
        // Fix: Mapping HTML field names to Mongoose Model names
        const mappedData = {
            title: req.body.Title,
            firstNames: req.body.First_Names,
            surname: req.body.Surname,
            idNumber: req.body.ID_Number,
            gender: req.body.Gender,
            maritalStatus: req.body.Marital_Status,
            race: req.body.Race,
            disability: req.body.Disability,
            disabilityDetails: req.body.Other_Disability_Detail,
            isFirstTimeApplicant: req.body.First_Time_Applicant,
            returningStudentDetails: req.body.Returning_Student_Details,
            phone: req.body.Phone,
            email: req.body.Email,
            nokName: req.body.NOK_First_Names,
            nokSurname: req.body.NOK_Surname,
            nokRelationship: req.body.NOK_Relationship,
            nokPhone: req.body.NOK_Phone,
            nokEmail: req.body.NOK_Email
        };

        // 1. Save to Database
        const newApp = new Assistance(mappedData);
        await newApp.save();

        // 2. Transporter Setup (Using your existing environment variables)
        const transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: Number(process.env.EMAIL_PORT),
            secure: true,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
            tls: { rejectUnauthorized: false }
        });

        // 3. The Tabulated Content (Shared for both emails)
        const detailsTable = `
            <table style="width: 100%; border-collapse: collapse; font-family: sans-serif; border: 1px solid #ddd;">
                <tr style="background: #004a99; color: white;"><th colspan="2" style="padding: 12px;">Application Summary</th></tr>
                <tr><td style="padding: 10px; border: 1px solid #ddd;"><b>Name</b></td><td style="padding: 10px; border: 1px solid #ddd;">${mappedData.firstNames} ${mappedData.surname}</td></tr>
                <tr style="background: #f9f9f9;"><td style="padding: 10px; border: 1px solid #ddd;"><b>ID Number</b></td><td style="padding: 10px; border: 1px solid #ddd;">${mappedData.idNumber}</td></tr>
                <tr><td style="padding: 10px; border: 1px solid #ddd;"><b>Contact</b></td><td style="padding: 10px; border: 1px solid #ddd;">${mappedData.phone}</td></tr>
                <tr style="background: #f9f9f9;"><td style="padding: 10px; border: 1px solid #ddd;"><b>Next of Kin</b></td><td style="padding: 10px; border: 1px solid #ddd;">${mappedData.nokName} (${mappedData.nokPhone})</td></tr>
                ${mappedData.returningStudentDetails ? `<tr><td style="padding: 10px; border: 1px solid #ddd; color: #ff6600;"><b>Prev. Details</b></td><td style="padding: 10px; border: 1px solid #ddd;">${mappedData.returningStudentDetails}</td></tr>` : ''}
            </table>
        `;

        // 4. Send Email to ADMIN (info@mycampuscollective.me)
        await transporter.sendMail({
            from: `"Campus Collective System" <${process.env.EMAIL_USER}>`,
            to: 'info@mycampuscollective.me',
            subject: `NEW ASSISTED APP: ${mappedData.firstNames} ${mappedData.surname}`,
            html: `<h3>A new assistance request has been logged.</h3>${detailsTable}`
        });

        // 5. Send Confirmation to STUDENT
        if (mappedData.email) {
            await transporter.sendMail({
                from: `"Campus Collective" <${process.env.EMAIL_USER}>`,
                to: mappedData.email,
                subject: `Request Received - ${mappedData.firstNames}`,
                html: `
                    <div style="font-family: sans-serif; color: #333; max-width: 600px;">
                        <h2 style="color: #004a99;">Hello ${mappedData.firstNames},</h2>
                        <p>Your assisted application request has been received! Our consultants will process your application shortly.</p>
                        <p><b>Here is a copy of your submitted details:</b></p>
                        ${detailsTable}
                        <p style="margin-top: 20px;">Best Regards,<br><b>Campus Collective Team</b></p>
                    </div>
                `
            });
        }

        res.status(201).json({ success: true, message: "Request received please check your emails" });
    } catch (error) {
        console.error("BACKEND ERROR:", error);
        res.status(500).json({ success: false, message: "Error sending Assistance request" });
    }
});

module.exports = router;