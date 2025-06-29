const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');

// Create checkout session
router.post('/create', transactionController.createTransaction);

// Stripe webhook endpoint - must use raw body for signature verification
router.post('/webhook', 
  express.raw({ type: 'application/json' }), 
  transactionController.stripeWebhook
);

module.exports = router; 