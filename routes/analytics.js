const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { verifyToken } = require('../middleware/auth');

// Single unified analytics endpoint - returns all charts and KPIs in one response
router.get('/dashboard', verifyToken, analyticsController.getUnifiedAnalytics);

// Debug endpoint to check transactions
router.get('/debug', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { period = 'all', startDate = null, endDate = null } = req.query;
    
    console.log(`Debug request - User: ${userId}, Period: ${period}, StartDate: ${startDate}, EndDate: ${endDate}`);
    
    const supabase = require('../supabaseClient');
    
    // Helper function to get date range (copied from analyticsController)
    function getDateRange(period, startDate = null, endDate = null) {
      const now = new Date();
      const start = new Date();
      
      // Handle custom date range
      if (period === 'custom' && startDate && endDate) {
        return { start: startDate, end: endDate };
      }
      
      switch (period) {
        case 'today': start.setHours(0, 0, 0, 0); break;
        case 'week': start.setDate(now.getDate() - 7); break;
        case 'month': start.setMonth(now.getMonth() - 1); break;
        case 'quarter': start.setMonth(now.getMonth() - 3); break;
        case 'year': start.setFullYear(now.getFullYear() - 1); break;
        case 'all': start.setFullYear(2020); break;
        default: start.setMonth(now.getMonth() - 1);
      }
      
      let endDateValue = now;
      if (period === 'all') {
        endDateValue = new Date();
        endDateValue.setFullYear(now.getFullYear() + 1);
      }
      
      return {
        start: start.toISOString().split('T')[0],
        end: endDateValue.toISOString().split('T')[0]
      };
    }
    
    // Get date range
    const { start, end } = getDateRange(period, startDate, endDate);
    console.log(`Date range: ${start} to ${end}`);
    
    // Get all transactions for the user (no date filter)
    const { data: allTransactions, error: allError } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });
    
    if (allError) {
      console.error('All transactions query error:', allError);
      return res.status(500).json({ error: allError.message });
    }
    
    console.log(`Found ${allTransactions ? allTransactions.length : 0} total transactions for user ${userId}`);
    
    // Get filtered transactions
    const { data: filteredTransactions, error: filteredError } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: false });
    
    if (filteredError) {
      console.error('Filtered transactions query error:', filteredError);
      return res.status(500).json({ error: filteredError.message });
    }
    
    console.log(`Found ${filteredTransactions ? filteredTransactions.length : 0} filtered transactions`);
    
    res.json({
      success: true,
      debug: {
        userId: userId,
        period: period,
        startDate: startDate,
        endDate: endDate,
        dateRange: { start, end },
        totalTransactions: allTransactions ? allTransactions.length : 0,
        filteredTransactions: filteredTransactions ? filteredTransactions.length : 0,
        allTransactions: allTransactions,
        filteredTransactions: filteredTransactions
      }
    });
  } catch (err) {
    console.error('Debug error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
