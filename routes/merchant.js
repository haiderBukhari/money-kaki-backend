const express = require('express');
const router = express.Router();
const merchantController = require('../controllers/merchantController');

// Create merchant
router.post('/', merchantController.createMerchant);
// Get all merchants
router.get('/', merchantController.getAllMerchants);
// Get merchant by id
router.get('/:id', merchantController.getMerchantById);
// Update merchant
router.put('/:id', merchantController.updateMerchant);
// Delete merchant
router.delete('/:id', merchantController.deleteMerchant);

module.exports = router; 