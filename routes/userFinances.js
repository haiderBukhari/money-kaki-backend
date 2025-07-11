const express = require('express');
const router = express.Router();
const userFinancesController = require('../controllers/userFinancesController');
const { verifyToken } = require('../middleware/auth');

router.post('/add-monthly-income', verifyToken, userFinancesController.addMonthlyIncome);
router.post('/add-monthly-expense', verifyToken, userFinancesController.addMonthlyExpense);
router.post('/add-categories', verifyToken, userFinancesController.addCategories);
router.post('/add-goals', verifyToken, userFinancesController.addGoals);
router.post('/add-amount-to-save', verifyToken, userFinancesController.addAmountToSave);
router.post('/add-today-spend', verifyToken, userFinancesController.addTodaySpend);
router.post('/add-transaction', verifyToken, userFinancesController.addTransaction);
router.get('/categories', verifyToken, userFinancesController.getCategories);
router.get('/goals', verifyToken, userFinancesController.getGoals);


module.exports = router; 