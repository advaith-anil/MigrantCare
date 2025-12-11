const mongoose = require('mongoose');

const adminCodeSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        unique: true
    }
}, { collection: 'admincodes' }); 

const AdminCode = mongoose.model('AdminCode', adminCodeSchema); 


module.exports = { AdminCode };
