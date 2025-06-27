const express = require('express');
const router = express.Router();
const privacyPolicyController = require('../controllers/privacyPolicyController');

// Create Privacy Policy
router.post('/create', privacyPolicyController.createPrivacyPolicy);

// Get Latest Privacy Policy
router.get('/latest', privacyPolicyController.getLatestPrivacyPolicy);

module.exports = router; 