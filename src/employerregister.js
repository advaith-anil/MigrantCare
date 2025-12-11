const express = require('express');
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
const path = require('path');
const mongoose = require('mongoose');
const { sendRegistrationEmail } = require('./utils/email');
const bcrypt = require('bcrypt');
const router = express.Router();

// Define Employer schema
const employerSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    fathersName: { type: String, required: true },
    mothersName: { type: String, required: true },
    gender: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true },
    Emerphone: { type: String, required: true },
    aadhaarNumber: { type: String, required: true },
    dob: { type: Date, required: true },
    CurrentAddress: { type: String, required: true },
    permanentAddress: { type: String, required: true },
    password: { type: String, required: true },
    companyName: { type: String, required: true },
    companyAddress: { type: String, required: true },
    registrationCode: { type: String, required: true },
    accountNoEmployer: { type: String, required: true },
    panNoEmployer: { type: String, required: true },
    ifscEmployer: { type: String, required: true },
    bankNameEmployer: { type: String, required: true },
    branchNameEmployer: { type: String, required: true },
    photo: { type: String },
    userType: { type: String, default: 'employer' }
});

const Employer = mongoose.model('Employer', employerSchema);

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Set up Cloudinary storage
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'employer_photos',
        format: async (req, file) => {
            const ext = path.extname(file.originalname).toLowerCase();
            if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
                return ext.slice(1); // remove the dot
            }
            return 'jpg'; // default format
        },
        public_id: (req, file) => Date.now() + '-' + path.basename(file.originalname, path.extname(file.originalname)),
        upload_preset: 'profile'
    },
});

const upload = multer({ storage: storage });

// Handle employer registration
router.post('/', upload.single('photo'), async (req, res) => {
    try {
        const employerData = req.body;
        if (req.file) {
            employerData.photo = req.file.path;
        }

        // Parse the date of birth
        employerData.dob = new Date(employerData.dob.split('-').reverse().join('-'));

        // Hash the password
        const saltRounds = 10; // Recommended value
        employerData.password = await bcrypt.hash(employerData.password, saltRounds);

        const newEmployer = new Employer(employerData);

        await newEmployer.save();
        await sendRegistrationEmail(employerData.email, 'employer');
        res.status(201).send({ message: 'Employer registered successfully', redirect: true, alert: true });

    } catch (error) {
        res.status(400).send({ error: 'Error registering employer: ' + error.message, alert: true });
    }
});

module.exports = router;
