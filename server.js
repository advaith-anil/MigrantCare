require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const redis = require("redis");
const adminRegisterRoutes = require('./src/adminregister.js');
const employeeRegisterRoutes = require('./src/employeeregister.js');
const employerRegisterRoutes = require('./src/employerregister.js');
const multer = require('multer');
const fs = require('fs');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

let otpStore = {}; // Temporary in-memory store for OTPs

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('src'));
app.use(express.static('src/Pages'));

// Set up cache control headers
app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    next();
});

// Set up MongoDB session store
const store = new MongoDBStore({
    uri: process.env.MONGODB_URI,
    collection: 'sessions'
});

// Add session middleware
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    store: store,
    cookie: { secure: false }
}));

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('Connected to MongoDB');
}).catch((error) => {
    console.error('Error connecting to MongoDB:', error);
});

const db = mongoose.connection;

const redisClient = redis.createClient({
    url: process.env.REDIS_URL
});

redisClient.on("error", (err) => {
    console.error("Redis Client Error", err);
    throw err;
});

redisClient.on("connect", () => console.log("Redis client connected"));

redisClient.connect().catch((error) => {
    console.error("Error connecting to Redis:", error);
});

// Configure nodemailer transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER, // Your email address
        pass: process.env.EMAIL_PASS  // Your email password or app password
    }
});

// Routes
app.use('/adminregister', adminRegisterRoutes);
app.use('/employeeregister', employeeRegisterRoutes);
app.use('/employerregister', employerRegisterRoutes);

app.post('/login', async (req, res) => {
    const { email, password, userType } = req.body;

    let collection;
    if (userType === 'admin') {
        collection = 'admins';
    } else if (userType === 'employee') {
        collection = 'employees';
    } else if (userType === 'employer') {
        collection = 'employers';
    } else {
        return res.status(400).json({ message: 'Invalid user type' });
    }

    try {
        const user = await db.collection(collection).findOne({ email });
        if (!user) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // Compare the provided password with the hashed password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid password' });
        }

        // Set session and cookies
        req.session.user = { email: user.email, userType };
        res.setHeader('Set-Cookie', `userType=${userType}; Path=/; HttpOnly`);
        res.setHeader('Set-Cookie', `email=${user.email}; Path=/; HttpOnly`);

        setTimeout(() => {
            return res.status(200).json({
                message: 'Login successful',
                userType: userType,
                email: user.email,
                redirect: '/home'
            });
        }, 500);
    } catch (error) {
        console.error('Error during login:', error.message);
        res.status(500).json({ message: 'An error occurred. Please try again.' });
    }
});

// Endpoint to fetch session data
app.get('/getUserSession', (req, res) => {
    if (req.session && req.session.user) {
        res.json(req.session.user);
    } else {
        res.status(401).json({ message: 'No active session' });
    }
});

// Endpoint to fetch user data based on collection and email
app.get('/users', async (req, res) => {
    const { collection, email } = req.query;

    if (!collection || !email) {
        return res.status(400).json({ message: 'Collection or email is missing' });
    }

    try {
        const user = await db.collection(collection).findOne(
            { email },
            { projection: { password: 0, _id: 0 } } // Exclude password and object ID
        );
        if (user) {
            res.json(user);
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error fetching user data' });
    }
});

// Fetch Admin Profile
app.get('/admin/profile', async (req, res) => {
    if (!req.session || !req.session.user || req.session.user.userType !== 'admin') {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
        const user = await db.collection('admins').findOne(
            { email: req.session.user.email },
            { projection: { password: 0, _id: 0 } } // Exclude password and object ID
        );
        if (user) {
            res.json({ success: true, user });
        } else {
            res.status(404).json({ success: false, message: 'Admin not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error fetching profile' });
    }
});

// Fetch Employee Profile
app.get('/employee/profile', async (req, res) => {
    if (!req.session || !req.session.user || req.session.user.userType !== 'employee') {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
        const user = await db.collection('employees').findOne(
            { email: req.session.user.email },
            { projection: { password: 0, _id: 0 } } // Exclude password and object ID
        );
        if (user) {
            res.json({ success: true, user });
        } else {
            res.status(404).json({ success: false, message: 'Employee not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error fetching profile' });
    }
});

// Fetch Employer Profile
app.get('/employer/profile', async (req, res) => {
    if (!req.session || !req.session.user || req.session.user.userType !== 'employer') {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
        const user = await db.collection('employers').findOne(
            { email: req.session.user.email },
            { projection: { password: 0, _id: 0 } } // Exclude password and object ID
        );
        if (user) {
            res.json({ success: true, user });
        } else {
            res.status(404).json({ success: false, message: 'Employer not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error fetching profile' });
    }
});

// API route to search employee by unique ID
app.get('/searchEmployee', async (req, res) => {
    const { uniqueNo } = req.query;
    try {
        const employee = await db.collection('employees').findOne(
            { uniqueNumber: uniqueNo },
            { projection: { password: 0, _id: 0 } } // Exclude password and object ID
        );
        if (employee) {
            res.json(employee);
        } else {
            res.status(404).json({ message: 'Employee not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error fetching employee' });
    }
});

// API route to add workers under the logged-in employer
app.post('/addWorker', async (req, res) => {
    const { workers } = req.body;
    const email = req.session.user.email;
    try {
        await db.collection('employerWorkers').updateOne(
            { email },
            { $set: { workers } },
            { upsert: true }
        );
        res.status(200).json({ message: 'Workers saved successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error saving workers' });
    }
});

// API route to fetch employer's saved workers
app.get('/getEmployerWorkers', async (req, res) => {
    const email = req.session.user.email;
    try {
        const employer = await db.collection('employerWorkers').findOne({ email });
        if (employer && employer.workers) {
            res.json(employer.workers);
        } else {
            res.status(404).json({ message: 'No workers found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error fetching workers' });
    }
});

// API route to delete worker
app.delete('/deleteWorker', async (req, res) => {
    const { uniqueNo } = req.query;
    const email = req.session.user.email;
    try {
        await db.collection('employerWorkers').updateOne(
            { email },
            { $pull: { workers: { uniqueNo } } }
        );
        res.status(200).json({ message: 'Worker deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting worker' });
    }
});

//Endpoint to delete employee
app.delete('/deleteEmployee', async (req, res) => {
    const { uniqueNo } = req.query;
    try {
        await db.collection('employees').deleteOne(
            { uniqueNumber: uniqueNo }
        );
        res.status(200).json({ message: 'Employee deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting employee' });
    }
});

//Endpoint to delete employer
app.delete('/deleteEmployer', async (req, res) => {
    const { email } = req.query;
    try {
        const result = await db.collection('employers').deleteOne(
            { email }
        );
        if (result.deletedCount > 0) {
            res.status(200).json({ message: 'Employer deleted successfully' });
        } else {
            res.status(404).json({ message: 'Employer not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error deleting employer' });
    }
});

// Endpoint to fetch total employers and employees
app.get('/getTotals', async (req, res) => {
    try {
        const totalEmployers = await db.collection('employers').countDocuments();
        const totalEmployees = await db.collection('employees').countDocuments();
        res.json({ totalEmployers, totalEmployees });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching totals' });
    }
});

// Endpoint to fetch registered employers
app.get('/getEmployers', async (req, res) => {
    try {
        const employers = await db.collection('employers').find().toArray();
        res.json(employers);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching employers' });
    }
});

// Endpoint to fetch registered employees
app.get('/getEmployees', async (req, res) => {
    try {
        const employees = await db.collection('employees').find().toArray();
        res.json(employees);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching employees' });
    }
});

// API route to update employer details
app.put('/updateEmployer', async (req, res) => {
    const { firstName, lastName, email, phone, companyName } = req.body;
    try {
        const result = await db.collection('employers').updateOne(
            { email },
            { $set: { firstName, lastName, phone, companyName } }
        );
        if (result.modifiedCount > 0) {
            res.status(200).json({ message: 'Employer details updated successfully' });
        } else {
            res.status(404).json({ message: 'Employer not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error updating employer details' });
    }
});

// API route to update employee details
app.put('/updateEmployee', async (req, res) => {
    const { firstName, lastName, email, phone, uniqueNo, aadhaarNo } = req.body;
    try {
        const result = await db.collection('employees').updateOne(
            { uniqueNumber: uniqueNo },
            { $set: { firstName, lastName, email, phone, aadhaarNumber: aadhaarNo } }
        );
        if (result.modifiedCount > 0) {
            res.status(200).json({ message: 'Employee details updated successfully' });
        } else {
            res.status(404).json({ message: 'Employee not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error updating employee details' });
    }
});

// API route to fetch employee location by email
app.get('/getEmployeeLocation', async (req, res) => {
    const { email } = req.query;
    try {
        if (!redisClient.isOpen) {
            await redisClient.connect();
        }
        const data = await redisClient.get(email);
        if (data) {
            res.json(JSON.parse(data));
        } else {
            res.status(404).json({ message: 'Location not found' });
        }
    } catch (error) {
        console.error('Error in /getEmployeeLocation route:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// API route to post a job
app.post('/postJob', async (req, res) => {
    const { title, description, latitude, longitude, tags, salary } = req.body;
    try {
        await db.collection('Jobs').insertOne({
            title,
            description,
            location: {
                type: "Point",
                coordinates: [longitude, latitude]
            },
            tags,
            salary,
            status: "Pending",
            postedBy: req.session.user.email,
            postedAt: new Date()
        });
        res.status(200).json({ message: 'Job posted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error posting job' });
    }
});

// API route to fetch all jobs
app.get('/getAllJobs', async (req, res) => {
    try {
        const jobs = await db.collection('Jobs').find().toArray();
        res.json(jobs);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching jobs' });
    }
});

// API route to fetch jobs based on category
app.get('/getNearbyJobs', async (req, res) => {
    const { category, status } = req.query;
    try {
        let query = { status: status || "Pending" };
        if (category && category !== 'all') {
            query.tags = { $in: [category] };
        }
        const jobs = await db.collection('Jobs').find(query).toArray();
        res.json(jobs);
    } catch (error) {
        console.error('Error fetching jobs:', error);
        res.status(500).json({ message: 'Error fetching jobs' });
    }
});

// API route to edit job details
app.put('/editJob', async (req, res) => {
    const { id, title, description, tags, salary } = req.body;
    try {
        const result = await db.collection('Jobs').updateOne(
            { _id: new mongoose.Types.ObjectId(id) },
            { $set: { title, description, tags, salary } }
        );
        if (result.modifiedCount > 0) {
            res.status(200).json({ message: 'Job details updated successfully' });
        } else {
            res.status(404).json({ message: 'Job not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error updating job details' });
    }
});

// API route to delete job
app.delete('/deleteJob', async (req, res) => {
    const { id } = req.query;
    try {
        const result = await db.collection('Jobs').deleteOne(
            { _id: new mongoose.Types.ObjectId(id) }
        );
        if (result.deletedCount > 0) {
            res.status(200).json({ message: 'Job deleted successfully' });
        } else {
            res.status(404).json({ message: 'Job not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error deleting job' });
    }
});

// API route to mark job as done
app.put('/markJobAsDone', async (req, res) => {
    const { id } = req.query;
    try {
        const result = await db.collection('Jobs').updateOne(
            { _id: new mongoose.Types.ObjectId(id) },
            { $set: { status: "Done" } }
        );
        if (result.modifiedCount > 0) {
            res.status(200).json({ message: 'Job marked as done successfully' });
        } else {
            res.status(404).json({ message: 'Job not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error marking job as done' });
    }
});

// Endpoint to send OTP
app.post('/sendOtp', async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ message: 'Email is required' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore[email] = otp; // Store OTP temporarily

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Your OTP for Migrant Care',
        text: `Your OTP is ${otp}. It is valid for 10 minutes.`
    };

    try {
        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: 'OTP sent successfully to your email.' });
    } catch (error) {
        console.error('Error sending OTP:', error.message);
        res.status(500).json({ message: 'Error sending OTP' });
    }
});

// Endpoint to verify OTP
app.post('/verifyOtp', (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) {
        return res.status(400).json({ message: 'Email and OTP are required' });
    }

    if (otpStore[email] === otp) {
        delete otpStore[email]; // Clear OTP after successful verification
        res.status(200).json({ message: 'OTP verified successfully' });
    } else {
        res.status(400).json({ message: 'Invalid OTP' });
    }
});

// Logout
app.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Error logging out' });
        }
        console.log('Session destroyed successfully');
        res.clearCookie('userType');
        res.clearCookie('email');
        res.status(200).json({ success: true, message: 'Logout successful' });
    });
});

// Login endpoint
app.get('/login', (req, res) => {
    const host = req.get('host');
    res.redirect(`http://${host}/`);
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'src', 'register.html'));
});

app.get('/home', (req, res) => {
    if (!req.session || !req.session.user) {
        return res.send(`
            <script>
                alert('Unauthorized');
                window.location.href = '/login';
            </script>
        `);
    }
    res.sendFile(path.join(__dirname, 'src/Pages', 'home.html'));
});

app.get('/adminprofile', (req, res) => {
    res.sendFile(path.join(__dirname, 'src/Pages', 'adminprofile.html'));
});

app.get('/admindashboard', (req, res) => {
    if (!req.session || !req.session.user || req.session.user.userType !== 'admin') {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    res.sendFile(path.join(__dirname, 'src/Pages', 'admindashboard.html'));
});

app.get('/employeeprofile', (req, res) => {
    res.sendFile(path.join(__dirname, 'src/Pages', 'employeeprofile.html'));
});

app.get('/employerprofile', (req, res) => {
    res.sendFile(path.join(__dirname, 'src/Pages', 'employerprofile.html'));
});

app.get('/employerdashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'src/Pages', 'employerdashboard.html'));
});

app.get('/adminregister', (req, res) => {
    res.sendFile(path.join(__dirname, 'src', 'adminregister.html'));
});

app.get('/employeeregister', (req, res) => {
    res.sendFile(path.join(__dirname, 'src', 'employeeregister.html'));
});

app.get('/employerregister', (req, res) => {
    res.sendFile(path.join(__dirname, 'src', 'employerregister.html'));
});

app.get('/about', (req, res) => {
    res.sendFile(path.join(__dirname, 'src/Pages', 'about.html'));
});

app.get('/map', (req, res) => {
    res.sendFile(path.join(__dirname, 'src/Pages', 'map.html'));
});

app.get('/getChatbotApiKey', (req, res) => {
    const apiKey = process.env.CHATBOT_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'API key not found in environment variables' });
    }
    res.json({ apiKey });
});

// WebSocket server setup
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on("connection", (ws) => {
    ws.on("message", async (data) => {
        const locationData = JSON.parse(data);
        if (locationData.type === "employee_location") {
            await redisClient.set(locationData.email, JSON.stringify({ latitude: locationData.latitude, longitude: locationData.longitude }));
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(locationData));
                }
            });
        }
    });
});

// Start the server
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
