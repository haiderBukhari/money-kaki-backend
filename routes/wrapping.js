const express = require('express');
const router = express.Router();
const wrappingController = require('../controllers/wrappingController');

router.post('/', wrappingController.createWrapping);
router.get('/', wrappingController.getAllWrappings);
router.get('/:id', wrappingController.getWrappingById);
router.delete('/:id', wrappingController.deleteWrapping);

module.exports = router; 