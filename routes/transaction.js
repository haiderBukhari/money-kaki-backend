const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const { verifyToken } = require('../middleware/auth');

router.post('/create', verifyToken, transactionController.createTransaction);

router.post('/webhook', 
  express.raw({ type: 'application/json' }), 
  transactionController.stripeWebhook
);

module.exports = router; 