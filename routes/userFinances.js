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
// AI-powered transaction creation (prompt-based)
router.post('/transactions/create-ai', verifyToken, userFinancesController.createTransactionAI);
// Direct transaction creation (structured data)
router.post('/transactions/create', verifyToken, userFinancesController.createTransaction);
// Create transaction from image using OCR
router.post('/transactions/create-from-image', verifyToken, userFinancesController.createTransactionFromImage);
router.post('/transactions/create-from-text', verifyToken, userFinancesController.createTransactionFromText);
router.get('/transactions', verifyToken, userFinancesController.getTransactions);
router.get('/categories', verifyToken, userFinancesController.getCategories);
router.get('/goals', verifyToken, userFinancesController.getGoals);
router.get('/get-income', verifyToken, userFinancesController.getIncome);
router.get('/user-finance-status', verifyToken, userFinancesController.getUserFinanceStatus);


module.exports = router; 