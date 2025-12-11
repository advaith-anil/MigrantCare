const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'employerdashboard.html'));
});

module.exports = router;
