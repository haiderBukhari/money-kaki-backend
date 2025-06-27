const express = require('express');
const router = express.Router();
const termsConditionsController = require('../controllers/termsConditionsController');

// Create Terms & Conditions
router.post('/create', termsConditionsController.createTermsConditions);

// Get Latest Terms & Conditions
router.get('/latest', termsConditionsController.getLatestTermsConditions);

module.exports = router; 