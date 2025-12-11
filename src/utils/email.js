const nodemailer = require('nodemailer');

// Nodemailer setup
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_SERVICE,
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Function to send registration email
const sendRegistrationEmail = async (email, userType) => {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Welcome to MigrantCare!',
        html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <h2>Welcome to MigrantCare!</h2>
                <p>Dear User,</p>
                <p>Thank you for registering as a <strong>${userType}</strong> on MigrantCare.</p>
                <p>We are excited to have you on board and look forward to serving you.</p>
                <p>If you have any questions, feel free to contact our support team.</p>
                <br>
                <p>Best regards,</p>
                <p>The MigrantCare Team</p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Email sent successfully to ${email}`);
    } catch (error) {
        console.error(`Error sending email to ${email}:`, error.message);
        throw new Error('Failed to send email');
    }
};

module.exports = { sendRegistrationEmail };
