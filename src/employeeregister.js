const express = require('express');
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const router = express.Router();
const { sendRegistrationEmail } = require('./utils/email');

// Define Employee schema
const employeeSchema = new mongoose.Schema({
    uniqueNumber: { type: String, required: true, unique: true },
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
    CurrentDistrict: { type: String, required: true },
    password: { type: String, required: true },
    permanentAddress: { type: String, required: true },
    permanentDistrict: { type: String, required: true },
    maritalStatue: { type: String, required: true },
    accountNo: { type: String, required: true },
    panNo: { type: String, required: true },
    ifsc: { type: String, required: true },
    bankName: { type: String, required: true },
    branchName: { type: String, required: true },
    photo: { type: String },
    userType: { type: String, default: 'employee' }
});

const Employee = mongoose.model('Employee', employeeSchema);

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
        folder: 'employee_photos',
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

// Handle employee registration
router.post('/', upload.single('photo'), async (req, res) => {
    const generateUniqueNumber = async () => {
        let uniqueNumber;
        let exists = true;
        let length = 6; // Start with 6 digits

        while (exists) {
            uniqueNumber = Math.floor(Math.random() * Math.pow(10, length)).toString().padStart(length, '0');
            const existingEmployee = await Employee.findOne({ uniqueNumber });
            exists = !!existingEmployee; // Check if the unique number already exists

            if (exists) {
                length++; // Increase the length if the number exists
            }
        }
        return uniqueNumber;
    };
    
    try {
        const employeeData = req.body;
        if (req.file) {
            employeeData.photo = req.file.path;
        }

        const uniqueNumber = await generateUniqueNumber();
        employeeData.uniqueNumber = uniqueNumber;
        if (employeeData.dob) {
            const [day, month, year] = employeeData.dob.split('-');
            employeeData.dob = new Date(`${year}-${month}-${day}`); 
        }

        // Hash the password
        const saltRounds = 10; // Recommended value
        employeeData.password = await bcrypt.hash(employeeData.password, saltRounds);

        const newEmployee = new Employee(employeeData);

        await newEmployee.save();
        await sendRegistrationEmail(employeeData.email, 'employee');
        res.status(201).send({ message: 'Employee registered successfully', uniqueNumber, redirect: true, alert: true });

    } catch (error) {
        res.status(400).send({ error: 'Error registering employee: ' + error.message, alert: true });
    }
});

module.exports = router;
