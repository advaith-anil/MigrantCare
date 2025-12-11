const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { AdminCode } = require('./models/adminCode');
const { sendRegistrationEmail } = require('./utils/email');
const bcrypt = require('bcrypt');

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Set up Cloudinary storage for multer
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'admin_photos',
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

// Define the admin schema
const adminSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: true
    },
    lastName: {
        type: String,
        required: true
    },
    fathersName: {
        type: String,
        required: true
    },
    mothersName: {
        type: String,
        required: true
    },
    gender: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    phone: {
        type: String,
        required: true
    },
    Emerphone: {
        type: String,
        required: true
    },
    aadhaarNumber: {
        type: String,
        required: true
    },
    dob: {
        type: Date,
        required: true
    },
    CurrentAddress: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    photo: {
        type: String,
        required: false
    },
    userType: {
        type: String,
        required: true,
        default: 'admin'
    }
});
const Admin = mongoose.model('Admin', adminSchema);

router.post('/', async (req, res) => {
    upload.single('photo')(req, res, async (err) => {
        if (err) {
            return res.status(400).json({ message: "Error uploading photo: " + err.message, alert: true });
        }

        const { firstName, lastName, fathersName, mothersName, email, phone, Emerphone, aadhaarNumber, dob, CurrentAddress, password, gender } = req.body;
        const parsedDob = new Date(dob.split('-').reverse().join('-')); // Convert to YYYY-MM-DD format

        const photo = req.file ? req.file.path : null; // This will be set after the upload

        const existingAdmin = await Admin.findOne({ email });
        if (existingAdmin) {
            return res.status(400).json({ message: "Admin with this email already exists.", alert: true });
        }

        const adminCodeProvided = req.body.adminCode; 
        const validAdminCode = await AdminCode.findOne({ code: adminCodeProvided }); 
        if (!validAdminCode) {
            return res.status(400).json({ message: "Invalid admin code.", alert: true }); 
        }

        // Hash the password
        const saltRounds = 10; // Recommended value
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const newAdmin = new Admin({
            photo,
            firstName,
            lastName,
            fathersName,
            mothersName,
            gender,
            email,
            phone,
            Emerphone,
            aadhaarNumber,
            dob: parsedDob, // Use parsedDob here
            CurrentAddress,
            password: hashedPassword,
            userType: 'admin'
        });

        try {
            await newAdmin.save();
            try {
                await sendRegistrationEmail(email, 'admin');
            } catch (emailError) {
                console.error('Error sending email:', emailError.message);
                return res.status(500).json({ message: "Admin registered, but email could not be sent. Please contact support.", alert: true });
            }
            res.status(201).json({ message: "Admin registered successfully", redirect: true, alert: true });
        } catch (error) {
            // If registration fails, delete the uploaded image from Cloudinary
            if (photo) {
                const publicId = photo.split('/').pop().split('.')[0]; // Extract public ID from the URL
                await cloudinary.uploader.destroy(publicId);
            }
            res.status(400).json({ message: "Error registering admin: " + error.message, alert: true });
        }
    });
});

module.exports = router;
