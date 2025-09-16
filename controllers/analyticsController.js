const supabase = require('../supabaseClient');

// Helper function to get date range based on period
function getDateRange(period, startDate = null, endDate = null) {
  const now = new Date();
  const start = new Date();
  
  // Handle custom date range
  if (period === 'custom' && startDate && endDate) {
    return {
      start: startDate,
      end: endDate
    };
  }
  
  switch (period) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      break;
    case 'week':
      start.setDate(now.getDate() - 7);
      break;
    case 'month':
      start.setMonth(now.getMonth() - 1);
      break;
    case 'quarter':
      start.setMonth(now.getMonth() - 3);
      break;
    case 'year':
      start.setFullYear(now.getFullYear() - 1);
      break;
    case 'all':
      start.setFullYear(2020); // Far back enough
      break;
    default:
      start.setMonth(now.getMonth() - 1); // Default to last month
  }
  
  // For 'all' period, extend the end date to include future dates
  let endDateValue = now;
  if (period === 'all') {
    endDateValue = new Date();
    endDateValue.setFullYear(now.getFullYear() + 1); // Include next year
  }
  
  return {
    start: start.toISOString().split('T')[0],
    end: endDateValue.toISOString().split('T')[0]
  };
}

// Helper function to format data for charts
function formatChartData(data, groupBy = 'category') {
  const grouped = {};
  
  data.forEach(item => {
    const key = item[groupBy] || 'Unknown';
    if (!grouped[key]) {
      grouped[key] = {
        name: key,
        value: 0,
        count: 0,
        transactions: []
      };
    }
    grouped[key].value += Math.abs(item.amount);
    grouped[key].count += 1;
    grouped[key].transactions.push(item);
  });
  
  return Object.values(grouped).sort((a, b) => b.value - a.value);
}

// 1. Category Spending Bar Chart
exports.getCategorySpending = async (req, res) => {
  try {
    const userId = req.user.id;
    const { period = 'month', type = 'expense', startDate = null, endDate = null } = req.query;
    const { start, end } = getDateRange(period, startDate, endDate);
    
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .eq('type', type)
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: false });
    
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    
    const chartData = formatChartData(data, 'category');
    
    res.json({
      success: true,
      data: {
        chartType: 'bar',
        title: `${type.charAt(0).toUpperCase() + type.slice(1)} by Category`,
        period: period,
        dateRange: { start, end },
        categories: chartData,
        total: chartData.reduce((sum, cat) => sum + cat.value, 0),
        transactionCount: data.length
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 2. Monthly Spending Trend Line Chart
exports.getMonthlyTrend = async (req, res) => {
  try {
    const userId = req.user.id;
    const { months = 12, type = 'expense', startDate = null, endDate = null } = req.query;
    const { start, end } = getDateRange('year', startDate, endDate);
    
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .eq('type', type)
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: true });
    
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    
    // Group by month
    const monthlyData = {};
    data.forEach(transaction => {
      const month = transaction.date.substring(0, 7); // YYYY-MM
      if (!monthlyData[month]) {
        monthlyData[month] = {
          month: month,
          amount: 0,
          count: 0
        };
      }
      monthlyData[month].amount += Math.abs(transaction.amount);
      monthlyData[month].count += 1;
    });
    
    const chartData = Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month));
    
    res.json({
      success: true,
      data: {
        chartType: 'line',
        title: `Monthly ${type.charAt(0).toUpperCase() + type.slice(1)} Trend`,
        months: parseInt(months),
        dateRange: { start, end },
        monthlyData: chartData,
        total: chartData.reduce((sum, month) => sum + month.amount, 0),
        average: chartData.length > 0 ? chartData.reduce((sum, month) => sum + month.amount, 0) / chartData.length : 0
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 3. Income vs Expense Pie Chart
exports.getIncomeExpenseRatio = async (req, res) => {
  try {
    const userId = req.user.id;
    const { period = 'month', startDate = null, endDate = null } = req.query;
    const { start, end } = getDateRange(period, startDate, endDate);
    
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .in('type', ['income', 'expense'])
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: false });
    
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    
    const income = data.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expense = data.filter(t => t.type === 'expense').reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    const chartData = [
      { name: 'Income', value: income, color: '#10B981' },
      { name: 'Expense', value: expense, color: '#EF4444' }
    ];
    
    const netIncome = income - expense;
    const savingsRate = income > 0 ? (netIncome / income) * 100 : 0;
    
    res.json({
      success: true,
      data: {
        chartType: 'pie',
        title: 'Income vs Expense',
        period: period,
        dateRange: { start, end },
        categories: chartData,
        summary: {
          totalIncome: income,
          totalExpense: expense,
          netIncome: netIncome,
          savingsRate: Math.round(savingsRate * 100) / 100
        }
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 4. Top Spending Categories (Donut Chart)
exports.getTopSpendingCategories = async (req, res) => {
  try {
    const userId = req.user.id;
    const { period = 'month', limit = 5, startDate = null, endDate = null } = req.query;
    const { start, end } = getDateRange(period, startDate, endDate);
    
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'expense')
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: false });
    
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    
    const chartData = formatChartData(data, 'category')
      .slice(0, parseInt(limit))
      .map((cat, index) => ({
        ...cat,
        color: `hsl(${index * 60}, 70%, 50%)` // Generate colors
      }));
    
    const total = chartData.reduce((sum, cat) => sum + cat.value, 0);
    
    res.json({
      success: true,
      data: {
        chartType: 'donut',
        title: `Top ${limit} Spending Categories`,
        period: period,
        dateRange: { start, end },
        categories: chartData,
        total: total,
        otherCategories: data.length - chartData.reduce((sum, cat) => sum + cat.count, 0)
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 5. Daily Spending Heatmap
exports.getDailySpendingHeatmap = async (req, res) => {
  try {
    const userId = req.user.id;
    const { period = 'month', startDate = null, endDate = null } = req.query;
    const { start, end } = getDateRange(period, startDate, endDate);
    
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'expense')
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: true });
    
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    
    // Group by date
    const dailyData = {};
    data.forEach(transaction => {
      const date = transaction.date;
      if (!dailyData[date]) {
        dailyData[date] = {
          date: date,
          amount: 0,
          count: 0
        };
      }
      dailyData[date].amount += Math.abs(transaction.amount);
      dailyData[date].count += 1;
    });
    
    const chartData = Object.values(dailyData).sort((a, b) => a.date.localeCompare(b.date));
    const maxAmount = Math.max(...chartData.map(d => d.amount));
    
    res.json({
      success: true,
      data: {
        chartType: 'heatmap',
        title: 'Daily Spending Pattern',
        period: period,
        dateRange: { start, end },
        dailyData: chartData,
        maxAmount: maxAmount,
        totalDays: chartData.length,
        averageDaily: chartData.length > 0 ? chartData.reduce((sum, day) => sum + day.amount, 0) / chartData.length : 0
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 6. Financial KPIs
exports.getFinancialKPIs = async (req, res) => {
  try {
    const userId = req.user.id;
    const { period = 'month', startDate = null, endDate = null } = req.query;
    const { start, end } = getDateRange(period, startDate, endDate);
    
    // Get all transactions for the period
    const { data: transactions, error: transError } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: false });
    
    if (transError) {
      return res.status(500).json({ error: transError.message });
    }
    
    // Get user finances data
    const { data: userFinances, error: financeError } = await supabase
      .from('user_finances')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (financeError && financeError.code !== 'PGRST116') {
      return res.status(500).json({ error: financeError.message });
    }
    
    // Calculate KPIs
    const income = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const netIncome = income - expense;
    const savingsRate = income > 0 ? (netIncome / income) * 100 : 0;
    
    // Category breakdown
    const categorySpending = {};
    transactions.filter(t => t.type === 'expense').forEach(t => {
      const category = t.category || 'Uncategorized';
      categorySpending[category] = (categorySpending[category] || 0) + Math.abs(t.amount);
    });
    
    const topCategory = Object.entries(categorySpending)
      .sort(([,a], [,b]) => b - a)[0];
    
    // Transaction frequency
    const transactionCount = transactions.length;
    const avgTransactionAmount = transactionCount > 0 ? 
      transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0) / transactionCount : 0;
    
    // Monthly budget vs actual (if available)
    const monthlyBudget = userFinances?.monthly_expense || 0;
    const budgetUtilization = monthlyBudget > 0 ? (expense / monthlyBudget) * 100 : 0;
    
    res.json({
      success: true,
      data: {
        period: period,
        dateRange: { start, end },
        kpis: {
          totalIncome: Math.round(income * 100) / 100,
          totalExpense: Math.round(expense * 100) / 100,
          netIncome: Math.round(netIncome * 100) / 100,
          savingsRate: Math.round(savingsRate * 100) / 100,
          transactionCount: transactionCount,
          avgTransactionAmount: Math.round(avgTransactionAmount * 100) / 100,
          topSpendingCategory: topCategory ? {
            category: topCategory[0],
            amount: Math.round(topCategory[1] * 100) / 100
          } : null,
          budgetUtilization: Math.round(budgetUtilization * 100) / 100,
          monthlyBudget: monthlyBudget
        },
        insights: {
          isOverspending: budgetUtilization > 100,
          isSaving: netIncome > 0,
          spendingTrend: 'stable', // Could be calculated based on historical data
          topCategoryPercentage: topCategory ? Math.round((topCategory[1] / expense) * 100) : 0
        }
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 7. Category Comparison (Multiple periods)
exports.getCategoryComparison = async (req, res) => {
  try {
    const userId = req.user.id;
    const { periods = 'current,previous', type = 'expense', startDate = null, endDate = null } = req.query;
    const periodList = periods.split(',');
    
    const results = {};
    
    for (const period of periodList) {
      const { start, end } = getDateRange(period, startDate, endDate);
      
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .eq('type', type)
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: false });
      
      if (error) {
        return res.status(500).json({ error: error.message });
      }
      
      results[period] = {
        dateRange: { start, end },
        data: formatChartData(data, 'category')
      };
    }
    
    res.json({
      success: true,
      data: {
        chartType: 'comparison',
        title: `Category ${type.charAt(0).toUpperCase() + type.slice(1)} Comparison`,
        periods: periodList,
        comparison: results
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 8. Spending by Transaction Type
exports.getSpendingByType = async (req, res) => {
  try {
    const userId = req.user.id;
    const { period = 'month', startDate = null, endDate = null } = req.query;
    const { start, end } = getDateRange(period, startDate, endDate);
    
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: false });
    
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    
    const chartData = formatChartData(data, 'type');
    
    res.json({
      success: true,
      data: {
        chartType: 'bar',
        title: 'Spending by Transaction Type',
        period: period,
        dateRange: { start, end },
        types: chartData,
        total: chartData.reduce((sum, type) => sum + type.value, 0)
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 9. Unified Analytics Dashboard - All data in one response
exports.getUnifiedAnalytics = async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      period = 'all', 
      type = 'expense', 
      periods = 'current,previous',
      startDate = null,
      endDate = null
    } = req.query;
    
    const { start, end } = getDateRange(period, startDate, endDate);
    
    console.log(`Analytics request - User: ${userId}, Period: ${period}, Date Range: ${start} to ${end}`);
    
    // Get all transactions for the period
    const { data: transactions, error: transError } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: false });
    
    if (transError) {
      console.error('Transaction query error:', transError);
      return res.status(500).json({ error: transError.message });
    }
    
    console.log(`Found ${transactions ? transactions.length : 0} transactions for user ${userId}`);
    if (transactions && transactions.length > 0) {
      console.log('Sample transaction:', transactions[0]);
    }
    
    // Get user finances data
    const { data: userFinances, error: financeError } = await supabase
      .from('user_finances')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (financeError && financeError.code !== 'PGRST116') {
      return res.status(500).json({ error: financeError.message });
    }
    
    // 1. Category Spending Bar Chart
    const categorySpendingData = formatChartData(
      transactions.filter(t => t.type === type), 
      'category'
    );
    
    // 2. Monthly Trend Line Chart
    const { start: trendStart, end: trendEnd } = getDateRange(period, startDate, endDate);
    const { data: trendTransactions, error: trendError } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .eq('type', type)
      .gte('date', trendStart)
      .lte('date', trendEnd)
      .order('date', { ascending: true });
    
    const monthlyData = {};
    if (!trendError && trendTransactions) {
      trendTransactions.forEach(transaction => {
        const month = transaction.date.substring(0, 7);
        if (!monthlyData[month]) {
          monthlyData[month] = { month, amount: 0, count: 0 };
        }
        monthlyData[month].amount += Math.abs(transaction.amount);
        monthlyData[month].count += 1;
      });
    }
    const monthlyTrendData = Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month));
    
    // 3. Income vs Expense Pie Chart
    const income = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const incomeExpenseData = [
      { name: 'Income', value: income, color: '#10B981' },
      { name: 'Expense', value: expense, color: '#EF4444' }
    ];
    
    // 4. Top Spending Categories Donut Chart
    const topCategoriesData = categorySpendingData
      .map((cat, index) => ({
        ...cat,
        color: `hsl(${index * 60}, 70%, 50%)`
      }));
    
    // 5. Daily Spending Heatmap
    const dailyData = {};
    transactions.filter(t => t.type === 'expense').forEach(transaction => {
      const date = transaction.date;
      if (!dailyData[date]) {
        dailyData[date] = { date, amount: 0, count: 0 };
      }
      dailyData[date].amount += Math.abs(transaction.amount);
      dailyData[date].count += 1;
    });
    const dailyHeatmapData = Object.values(dailyData).sort((a, b) => a.date.localeCompare(b.date));
    const maxDailyAmount = Math.max(...dailyHeatmapData.map(d => d.amount), 0);
    
    // 6. Financial KPIs
    const netIncome = income - expense;
    const savingsRate = income > 0 ? (netIncome / income) * 100 : 0;
    const categorySpending = {};
    transactions.filter(t => t.type === 'expense').forEach(t => {
      const category = t.category || 'Uncategorized';
      categorySpending[category] = (categorySpending[category] || 0) + Math.abs(t.amount);
    });
    const topCategory = Object.entries(categorySpending).sort(([,a], [,b]) => b - a)[0];
    const transactionCount = transactions.length;
    const avgTransactionAmount = transactionCount > 0 ? 
      transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0) / transactionCount : 0;
    const monthlyBudget = userFinances?.monthly_expense || 0;
    const budgetUtilization = monthlyBudget > 0 ? (expense / monthlyBudget) * 100 : 0;
    
    // 7. Spending by Type
    const spendingByTypeData = formatChartData(transactions, 'type');
    
    // 8. Category Comparison (current vs previous)
    const periodList = periods.split(',');
    const comparisonData = {};
    
    for (const compPeriod of periodList) {
      // For custom period, use the same date range for all comparisons
      let compStart, compEnd;
      if (period === 'custom' && startDate && endDate) {
        compStart = startDate;
        compEnd = endDate;
      } else {
        const range = getDateRange(compPeriod, startDate, endDate);
        compStart = range.start;
        compEnd = range.end;
      }
      const { data: compTransactions, error: compError } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .eq('type', type)
        .gte('date', compStart)
        .lte('date', compEnd)
        .order('date', { ascending: false });
      
      if (!compError && compTransactions) {
        comparisonData[compPeriod] = {
          dateRange: { start: compStart, end: compEnd },
          data: formatChartData(compTransactions, 'category')
        };
      }
    }
    
    // Compile unified response
    res.json({
      success: true,
      data: {
        period: period,
        dateRange: { start, end },
        charts: {
          // 1. Category Spending Bar Chart
          categorySpending: {
            chartType: 'bar',
            title: `${type.charAt(0).toUpperCase() + type.slice(1)} by Category`,
            data: categorySpendingData,
            total: categorySpendingData.reduce((sum, cat) => sum + cat.value, 0),
            transactionCount: transactions.filter(t => t.type === type).length
          },
          
          // 2. Monthly Trend Line Chart
          monthlyTrend: {
            chartType: 'line',
            title: `Monthly ${type.charAt(0).toUpperCase() + type.slice(1)} Trend`,
            data: monthlyTrendData,
            total: monthlyTrendData.reduce((sum, month) => sum + month.amount, 0),
            average: monthlyTrendData.length > 0 ? 
              monthlyTrendData.reduce((sum, month) => sum + month.amount, 0) / monthlyTrendData.length : 0
          },
          
          // 3. Income vs Expense Pie Chart
          incomeExpenseRatio: {
            chartType: 'pie',
            title: 'Income vs Expense',
            data: incomeExpenseData,
            summary: {
              totalIncome: Math.round(income * 100) / 100,
              totalExpense: Math.round(expense * 100) / 100,
              netIncome: Math.round(netIncome * 100) / 100,
              savingsRate: Math.round(savingsRate * 100) / 100
            }
          },
          
          // 4. Top Spending Categories Donut Chart
          topSpendingCategories: {
            chartType: 'donut',
            title: 'All Spending Categories',
            data: topCategoriesData,
            total: topCategoriesData.reduce((sum, cat) => sum + cat.value, 0),
            otherCategories: transactions.filter(t => t.type === 'expense').length - 
              topCategoriesData.reduce((sum, cat) => sum + cat.count, 0)
          },
          
          // 5. Daily Spending Heatmap
          dailySpendingHeatmap: {
            chartType: 'heatmap',
            title: 'Daily Spending Pattern',
            data: dailyHeatmapData,
            maxAmount: maxDailyAmount,
            totalDays: dailyHeatmapData.length,
            averageDaily: dailyHeatmapData.length > 0 ? 
              dailyHeatmapData.reduce((sum, day) => sum + day.amount, 0) / dailyHeatmapData.length : 0
          },
          
          // 6. Spending by Type Bar Chart
          spendingByType: {
            chartType: 'bar',
            title: 'Spending by Transaction Type',
            data: spendingByTypeData,
            total: spendingByTypeData.reduce((sum, type) => sum + type.value, 0)
          },
          
          // 7. Category Comparison
          categoryComparison: {
            chartType: 'comparison',
            title: `Category ${type.charAt(0).toUpperCase() + type.slice(1)} Comparison`,
            periods: periodList,
            data: comparisonData
          }
        },
        
        // 8. Financial KPIs
        kpis: {
          totalIncome: Math.round(income * 100) / 100,
          totalExpense: Math.round(expense * 100) / 100,
          netIncome: Math.round(netIncome * 100) / 100,
          savingsRate: Math.round(savingsRate * 100) / 100,
          transactionCount: transactionCount,
          avgTransactionAmount: Math.round(avgTransactionAmount * 100) / 100,
          topSpendingCategory: topCategory ? {
            category: topCategory[0],
            amount: Math.round(topCategory[1] * 100) / 100
          } : null,
          budgetUtilization: Math.round(budgetUtilization * 100) / 100,
          monthlyBudget: monthlyBudget,
          walletAmount: Math.round((userFinances?.wallet || 0) * 100) / 100
        },
        
        // 9. Insights
        insights: {
          isOverspending: budgetUtilization > 100,
          isSaving: netIncome > 0,
          spendingTrend: 'stable', // Could be calculated based on historical data
          topCategoryPercentage: topCategory ? Math.round((topCategory[1] / expense) * 100) : 0,
          periodSummary: {
            totalTransactions: transactionCount,
            averageDailySpending: dailyHeatmapData.length > 0 ? 
              dailyHeatmapData.reduce((sum, day) => sum + day.amount, 0) / dailyHeatmapData.length : 0,
            mostActiveDay: dailyHeatmapData.length > 0 ? 
              dailyHeatmapData.reduce((max, day) => day.amount > max.amount ? day : max) : null
          }
        }
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
