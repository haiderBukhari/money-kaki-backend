const express = require('express');
const router = express.Router();
const rewardController = require('../controllers/rewardController');

// Basic CRUD
router.post('/', rewardController.createReward);
router.get('/', rewardController.getAllRewards);
router.get('/available-quantity', rewardController.getAllRewardsWithAvailableQuantity);

router.get('/:id', rewardController.getRewardById);
router.put('/:id', rewardController.updateReward);
router.delete('/:id', rewardController.deleteReward);

// Add a single code
router.post('/:id/code', rewardController.addRewardCode);
// Add multiple codes (bulk)
router.post('/:id/codes', rewardController.addRewardCodesBulk);
// Remove a code
router.delete('/:id/codes', rewardController.removeRewardCode);

// Get all rewards with available quantity

module.exports = router; 