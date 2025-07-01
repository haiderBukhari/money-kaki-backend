const express = require('express');
const router = express.Router();
const rewardAssigneeController = require('../controllers/rewardAssigneeController');
const { verifyToken } = require('../middleware/auth');

// Create
router.post('/', verifyToken, rewardAssigneeController.createRewardAssignee);
// Read all
router.get('/', rewardAssigneeController.getAllRewardAssignees);
// Read by id
router.get('/:id', rewardAssigneeController.getRewardAssigneeById);
// Update
router.put('/:id', rewardAssigneeController.updateRewardAssignee);
// Delete
router.delete('/:id', rewardAssigneeController.deleteRewardAssignee);
// Get all reward assignees for the current user
router.get('/mine', verifyToken, rewardAssigneeController.getRewardAssigneesByAssignee);

module.exports = router; 