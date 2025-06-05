const express = require('express');
const router = express.Router();
const advisorController = require('../controllers/advisorController');

router.post('/create', advisorController.createAdvisor);
router.post('/verify-email', advisorController.verifyEmail);
router.post('/create-password', advisorController.createPassword);
router.get('/login', advisorController.loginAdvisor);

router.get('/requests', advisorController.getInactiveAdvisors);
router.put('/requests/:id', advisorController.toggleAdvisorStatus);


router.get('/', advisorController.getAllAdvisors);
router.put('/:id', advisorController.editAdvisor);
router.get('/:id', advisorController.getAdvisorById);
router.delete('/:id', advisorController.deleteAdvisor);


module.exports = router; 