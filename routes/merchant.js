const express = require('express');
const router = express.Router();
const merchantController = require('../controllers/merchantController');
const { verifyToken } = require('../middleware/auth');

// Create merchant
router.post('/', merchantController.createMerchant);
// Get all merchants
router.get('/', merchantController.getAllMerchants);
// Get all available merchants (quantity > 0)
router.get('/get-all-merchants', verifyToken, merchantController.getAllAvailableMerchants);
// Get merchant by id
router.get('/:id', merchantController.getMerchantById);
// Update merchant
router.put('/:id', merchantController.updateMerchant);
// Delete merchant
router.delete('/:id', merchantController.deleteMerchant);
// Redeem merchant
router.post('/redeem/:id', verifyToken, merchantController.redeemMerchant);

module.exports = router; 