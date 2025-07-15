const express = require('express');
const router = express.Router();
const goalsController = require('../controllers/goalsController');
const { verifyToken } = require('../middleware/auth');

// Goals CRUD
router.post('/goals', verifyToken, goalsController.createGoal);
router.get('/goals', verifyToken, goalsController.getGoals);
router.put('/goals/:id', verifyToken, goalsController.updateGoal);
router.delete('/goals/:id', verifyToken, goalsController.deleteGoal);

// Savings CRUD
router.post('/savings', verifyToken, goalsController.createSaving);
router.get('/savings/:goal_id', verifyToken, goalsController.getSavings);
router.put('/savings/:id', verifyToken, goalsController.updateSaving);
router.delete('/savings/:id', verifyToken, goalsController.deleteSaving);

module.exports = router; 