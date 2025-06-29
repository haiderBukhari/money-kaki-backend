const express = require('express');
const router = express.Router();
const advisorController = require('../controllers/advisorController');
const { verifyToken } = require('../middleware/auth');

router.post('/create', advisorController.createAdvisor);
router.post('/verify-email', advisorController.verifyEmail);
router.post('/create-password', advisorController.createPassword);
router.get('/login', advisorController.loginAdvisor);
router.post('/oauth-login', advisorController.oauthLogin);
router.get('/role', verifyToken, advisorController.getRole);
router.get('/credits', verifyToken, advisorController.getAdvisorCredits);

// Password reset routes
router.post('/forgot-password', advisorController.requestPasswordReset);
router.post('/verify-reset-code', advisorController.verifyResetCode);
router.post('/reset-password', advisorController.resetPassword);

router.get('/requests', advisorController.getInactiveAdvisors);
router.put('/requests/:id', advisorController.toggleAdvisorStatus);
router.post('/decline/:id', advisorController.declineAdvisor);

router.get('/', advisorController.getAllAdvisors);
router.put('/:id', advisorController.editAdvisor);
router.get('/:id', advisorController.getAdvisorById);
router.delete('/:id', advisorController.deleteAdvisor);

module.exports = router; 