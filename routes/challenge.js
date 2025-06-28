const express = require('express');
const router = express.Router();
const challengeController = require('../controllers/challengeController');
const { verifyToken } = require('../middleware/auth');

// Basic CRUD operations
router.post('/', verifyToken, challengeController.createChallenge);
router.get('/', verifyToken, challengeController.getAllChallenges);
router.get('/user/:user_id', challengeController.getChallengesByUserId);
router.get('/:id', challengeController.getChallengeById);
router.put('/:id', verifyToken, challengeController.updateChallenge);
router.delete('/:id', verifyToken, challengeController.deleteChallenge);

module.exports = router; 