const express = require('express');
const router = express.Router();
const advisorController = require('../controllers/advisorController');
const { verifyToken } = require('../middleware/auth');

// Create advisor


// Advisor authentication
router.post('/verify-email', advisorController.verifyEmail);
router.post('/create-password', advisorController.createPassword);
router.get('/login', advisorController.loginAdvisor);
router.post('/oauth-login', advisorController.oauthLogin);
router.get('/role', verifyToken, advisorController.getRole);

// Password reset
router.post('/forgot-password', advisorController.requestPasswordReset);
router.post('/verify-reset-code', advisorController.verifyResetCode);
router.post('/reset-password', advisorController.resetPassword);

// Advisor management
router.get('/requests/inactive', advisorController.getInactiveAdvisors);
router.put('/requests/:id', advisorController.toggleAdvisorStatus);
router.post('/decline/:id', advisorController.declineAdvisor);
router.get('/credits', verifyToken, advisorController.getAdvisorCredits);

// Advisor reward management
router.get('/rewards', verifyToken, advisorController.getAdvisorRewards);
router.post('/redeem-reward', verifyToken, advisorController.redeemAdvisorReward);
router.get('/notifications', verifyToken, advisorController.getAdvisorNotifications);
router.get('/revenue', verifyToken, advisorController.getAdvisorRevenue);
router.get('/dashboard-stats', verifyToken, advisorController.getDashboardStats);

router.post('/create', advisorController.createAdvisor);
// Get all advisors
router.get('/', advisorController.getAllAdvisors);
// Get advisor by id
router.get('/:id', advisorController.getAdvisorById);
// Update advisor
router.put('/:id', advisorController.editAdvisor);
// Delete advisor
router.delete('/:id', advisorController.deleteAdvisor);

module.exports = router; 