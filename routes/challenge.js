const express = require('express');
const router = express.Router();
const challengeController = require('../controllers/challengeController');
const { verifyToken } = require('../middleware/auth');
const { triggerChallengeCronJob } = require('../utils/cronJobs');

// Basic CRUD operations
router.post('/', verifyToken, challengeController.createChallenge);
router.get('/', verifyToken, challengeController.getAllChallenges);
router.get('/user/redeemable', verifyToken, challengeController.getUserRedeemableChallenges);
router.get('/user/redeemed', verifyToken, challengeController.getUserRedeemedChallenges);
router.post('/redeem', verifyToken, challengeController.redeemChallenge);

router.get('/user/:user_id', challengeController.getChallengesByUserId);
router.get('/:id', challengeController.getChallengeById);
router.put('/:id', verifyToken, challengeController.updateChallenge);
router.delete('/:id', verifyToken, challengeController.deleteChallenge);

// Get user's redeemable challenges (with points or rewards)

// Redeem a challenge

// Manual trigger for challenge cron job (for testing)
router.post('/trigger-cron', verifyToken, async (req, res) => {
  try {
    // Check if user is admin (you can modify this check based on your admin logic)
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    triggerChallengeCronJob();
    res.json({ message: 'Challenge cron job triggered successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router; 