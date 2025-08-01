const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const userController = require('../controllers/userController');

router.post('/create', userController.createUser);
router.post('/verify-email', userController.verifyEmail);
router.post('/create-password', userController.createPassword);
router.get('/login', userController.loginUser);
router.post('/oauth-login', userController.oauthLogin);
router.get('/role', verifyToken, userController.getRole);

router.get('/profile', verifyToken, userController.getProfile);
router.put('/profile', verifyToken, userController.updateProfile);

router.post('/forgot-password', userController.requestPasswordReset);
router.post('/verify-reset-code', userController.verifyResetCode);
router.post('/reset-password', userController.resetPassword);

router.get('/requests', userController.getInactiveUsers);
router.put('/requests/:id', userController.toggleUserStatus);
router.post('/decline/:id', userController.declineUser);

router.get('/points', verifyToken, userController.getPoints);
router.get('/assigned', verifyToken, userController.getUsersByRole);

router.delete('/delete-account', verifyToken, userController.deleteOwnAccount);

router.get('/:userId/advisors', userController.getUserAdvisors);
router.put('/:userId/assign/:advisorId', verifyToken, userController.changeUserAdvisor);
router.post('/send-verification-code', verifyToken, userController.sendVerificationCode);
router.get('/notifications', verifyToken, userController.getUserNotifications);
router.post('/redeem-reward', verifyToken, userController.redeemUserReward);
router.get('/advisor-rewards', verifyToken, userController.getUserAdvisorRewards);

router.get('/', userController.getAllUsers);
router.put('/:id', userController.editUser);
router.get('/:id', userController.getUserById);
router.delete('/:id', userController.deleteUser);


module.exports = router; 