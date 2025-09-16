const supabase = require('../supabaseClient');
const { askClaude, extractMonthlyIncome, extractMonthlyExpense, extractAmountToSave, extractTodaySpend, extractTransactionFromImage, extractTransactionFromText } = require('../utils/textagent');
const { requestPasswordReset } = require('./advisorController');

// Helper to get or create user_finances row
async function getOrCreateUserFinances(userId) {
  let { data, error } = await supabase
    .from('user_finances')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (!data) {
    const { data: newData, error: insertError } = await supabase
      .from('user_finances')
      .insert({ user_id: userId, monthly_income: 0, monthly_expense: 0 })
      .select('*')
      .single();
    if (insertError) throw insertError;
    return newData;
  }
  if (error) throw error;
  return data;
}

exports.addMonthlyIncome = async (req, res) => {
  try {
    const userId = req.user.id;
    const { monthly_income } = req.body;
    
    let incomeAmount = monthly_income;
    
    // If monthly_income is a string (prompt), use AI to extract income amount
    if (typeof monthly_income === 'string') {
      incomeAmount = await extractMonthlyIncome(monthly_income);
    } else if (monthly_income == null) {
      return res.status(400).json({ error: 'monthly_income required' });
    }
    
    await getOrCreateUserFinances(userId);
    const { data, error } = await supabase
      .from('user_finances')
      .update({ monthly_income: incomeAmount })
      .eq('user_id', userId)
      .select('*')
      .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ user_finances: data, extracted_amount: incomeAmount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.addMonthlyExpense = async (req, res) => {
  try {
    const userId = req.user.id;
    const { monthly_expense } = req.body;
    
    let expenseAmount = monthly_expense;
    
    // If monthly_expense is a string (prompt), use AI to extract expense amount
    if (typeof monthly_expense === 'string') {
      expenseAmount = await extractMonthlyExpense(monthly_expense);
    } else if (monthly_expense == null) {
      return res.status(400).json({ error: 'monthly_expense required' });
    }
    
    await getOrCreateUserFinances(userId);
    const { data, error } = await supabase
      .from('user_finances')
      .update({ monthly_expense: expenseAmount })
      .eq('user_id', userId)
      .select('*')
      .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ user_finances: data, extracted_amount: expenseAmount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.addCategories = async (req, res) => {
  try {
    const userId = req.user.id;
    const { selected_category } = req.body;
    if (!selected_category) return res.status(400).json({ error: 'selected_category required' });
    await getOrCreateUserFinances(userId);
    const { data, error } = await supabase
      .from('user_finances')
      .update({ selected_category })
      .eq('user_id', userId)
      .select('*')
      .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ user_finances: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.addGoals = async (req, res) => {
  try {
    const userId = req.user.id;
    const { goal_to_achieve } = req.body;
    if (!goal_to_achieve) return res.status(400).json({ error: 'goal_to_achieve required' });
    await getOrCreateUserFinances(userId);
    const { data, error } = await supabase
      .from('user_finances')
      .update({ goal_to_achieve })
      .eq('user_id', userId)
      .select('*')
      .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ user_finances: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.addAmountToSave = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount_to_save } = req.body;
    
    let saveAmount = amount_to_save;
    
    // If amount_to_save is a string (prompt), use AI to extract save amount
    if (typeof amount_to_save === 'string') {
      saveAmount = await extractAmountToSave(amount_to_save);
    } else if (amount_to_save == null) {
      return res.status(400).json({ error: 'amount_to_save required' });
    }
    
    await getOrCreateUserFinances(userId);
    const { data, error } = await supabase
      .from('user_finances')
      .update({ amount_to_save: saveAmount })
      .eq('user_id', userId)
      .select('*')
      .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ user_finances: data, extracted_amount: saveAmount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.addTodaySpend = async (req, res) => {
  try {
    const userId = req.user.id;
    const { today_spend } = req.body;
    
    let spendAmount = today_spend;
    
    // If today_spend is a string (prompt), use AI to extract today's spend amount
    if (typeof today_spend === 'string') {
      spendAmount = await extractTodaySpend(today_spend);
    } else if (today_spend == null) {
      return res.status(400).json({ error: 'today_spend required' });
    }
    
    await getOrCreateUserFinances(userId);
    const { data, error } = await supabase
      .from('user_finances')
      .update({ today_spend: spendAmount })
      .eq('user_id', userId)
      .select('*')
      .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ user_finances: data, extracted_amount: spendAmount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.addTransaction = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log(req.body)
    const { transaction } = req.body;
    if (!transaction) return res.status(400).json({ error: 'transaction required' });
    await getOrCreateUserFinances(userId);
    const { data: current, error: getError } = await supabase
      .from('user_finances')
      .select('transaction')
      .eq('user_id', userId)
      .single();
    let newTransactions = [];
    if (current && current.transaction) {
      newTransactions = Array.isArray(current.transaction) ? current.transaction : [];
    }
    newTransactions.push(transaction);
    const { data, error } = await supabase
      .from('user_finances')
      .update({ transaction: newTransactions })
      .eq('user_id', userId)
      .select('*')
      .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ user_finances: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// AI-powered transaction creation (prompt-based)
exports.createTransactionAI = async (req, res) => {
  try {
    const userId = req.user.id;
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'prompt required' });
    // AI prompt for transaction extraction
    const aiPrompt = `Extract all transactions from the following user statement. For each transaction, extract the amount, type (income, expense, transfer, investment), title, description, category, and date (YYYY-MM-DD). Return only JSON in the format: { "transactions": [ { "amount": <number>, "type": <string>, "title": <string>, "description": <string>, "category": <string>, "date": <string> }, ... ] }. User statement: "${prompt}"`;
    const aiResponse = await askClaude(aiPrompt);
    let transactions;
    try {
      transactions = JSON.parse(aiResponse.content[0].text).transactions;
    } catch (e) {
      return res.status(400).json({ error: 'Could not extract transactions from prompt.' });
    }
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({ error: 'No transactions found in prompt.' });
    }
    // Insert each transaction
    const inserts = transactions.map(tx => ({
      user_id: userId,
      amount: tx.amount,
      type: tx.type,
      title: tx.title,
      description: tx.description,
      category: tx.category,
      date: tx.date
    }));
    const { data, error } = await supabase
      .from('transactions')
      .insert(inserts)
      .select('*');
    if (error) return res.status(500).json({ error: error.message });

    // Add income transactions to wallet
    const incomeTransactions = transactions.filter(tx => tx.type === 'income');
    if (incomeTransactions.length > 0) {
      const totalIncome = incomeTransactions.reduce((sum, tx) => sum + tx.amount, 0);
      
      // Get current wallet balance
      const { data: userFinances, error: financeError } = await supabase
        .from('user_finances')
        .select('wallet')
        .eq('user_id', userId)
        .single();
      
      if (!financeError && userFinances) {
        const currentWallet = userFinances.wallet || 0;
        const newWalletAmount = currentWallet + totalIncome;
        
        // Update wallet
        await supabase
          .from('user_finances')
          .update({ wallet: newWalletAmount })
          .eq('user_id', userId);
      }
    }

    res.status(201).json({ transactions: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Direct transaction creation (structured data)
exports.createTransaction = async (req, res) => {
  try {
    const userId = req.user.id;
    const {amount, type, title, description, category, date}  = req.body;
    if (!amount || !type || !title || !category || !date) return res.status(400).json({ error: 'Transaction data required' });
    // Validate and map
    const { data, error } = await supabase
      .from('transactions')
      .insert({user_id: userId, amount, type, title, description, category, date})
      .select('*');
    if (error) return res.status(500).json({ error: error.message });

    // Add income to wallet
    if (type === 'income') {
      // Get current wallet balance
      const { data: userFinances, error: financeError } = await supabase
        .from('user_finances')
        .select('wallet')
        .eq('user_id', userId)
        .single();
      
      if (!financeError && userFinances) {
        const currentWallet = userFinances.wallet || 0;
        const newWalletAmount = currentWallet + amount;
        
        // Update wallet
        await supabase
          .from('user_finances')
          .update({ wallet: newWalletAmount })
          .eq('user_id', userId);
      }
    }

    res.status(201).json({ transactions: data });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Create transaction from image using OCR
exports.createTransactionFromImage = async (req, res) => {
  try {
    const userId = req.user.id;
    const { image } = req.body;
    
    if (!image) {
      return res.status(400).json({ error: 'Image is required' });
    }

    // Available categories for the AI to choose from
    const categories = [
      "Special Promos",
      "Food & Drinks",
      "Car",
      "Shopping",
      "Transport",
      "Travel",
      "Entertainment",
      "Health",
      "Grocery",
      "Pet",
      "Education",
      "Electronics",
      "Beauty",
      "Sports"
    ];

    // Extract transaction details from image using OCR
    const extractedTransaction = await extractTransactionFromImage(image, categories);

    // Validate extracted data
    if (!extractedTransaction.amount || extractedTransaction.amount <= 0) {
      return res.status(400).json({ error: 'Could not extract valid amount from image' });
    }

    // Create transaction in database
    const { data, error } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        amount: extractedTransaction.amount,
        type: extractedTransaction.type,
        title: extractedTransaction.title,
        description: extractedTransaction.description,
        category: extractedTransaction.category,
        date: extractedTransaction.date
      })
      .select('*');

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // Add income to wallet
    if (extractedTransaction.type === 'income') {
      // Get current wallet balance
      const { data: userFinances, error: financeError } = await supabase
        .from('user_finances')
        .select('wallet')
        .eq('user_id', userId)
        .single();
      
      if (!financeError && userFinances) {
        const currentWallet = userFinances.wallet || 0;
        const newWalletAmount = currentWallet + extractedTransaction.amount;
        
        // Update wallet
        await supabase
          .from('user_finances')
          .update({ wallet: newWalletAmount })
          .eq('user_id', userId);
      }
    }

    res.status(201).json({ 
      message: 'Transaction created successfully from image',
      transaction: data[0],
      extracted_data: extractedTransaction
    });

  } catch (err) {
    console.error('Error creating transaction from image:', err);
    res.status(500).json({ error: err.message });
  }
};

// Create transaction from text prompt
exports.createTransactionFromText = async (req, res) => {
  try {
    const userId = req.user.id;
    const { prompt } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Text prompt is required' });
    }

    // Available categories for the AI to choose from
    const categories = [
      "Special Promos",
      "Food & Drinks",
      "Car",
      "Shopping",
      "Transport",
      "Travel",
      "Entertainment",
      "Health",
      "Grocery",
      "Pet",
      "Education",
      "Electronics",
      "Beauty",
      "Sports"
    ];

    // Extract transaction details from text using AI
    const extractedTransaction = await extractTransactionFromText(prompt, categories);

    // Validate extracted data
    if (!extractedTransaction.amount || extractedTransaction.amount <= 0) {
      return res.status(400).json({ error: 'Could not extract valid amount from text' });
    }

    // Create transaction in database
    const { data, error } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        amount: extractedTransaction.amount,
        type: extractedTransaction.type,
        title: extractedTransaction.title,
        description: extractedTransaction.description,
        category: extractedTransaction.category,
        date: extractedTransaction.date
      })
      .select('*');

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.status(201).json({ 
      message: 'Transaction created successfully from text',
      transaction: data[0],
      extracted_data: extractedTransaction
    });

  } catch (err) {
    console.error('Error creating transaction from text:', err);
    res.status(500).json({ error: err.message });
  }
};

// Get all transactions for the user
exports.getTransactions = async (req, res) => {
  try {
    const userId = req.user.id;
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ transactions: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getCategories = async (req, res) => {
  const categories = [
    "Special Promos",
    "Food & Drinks",
    "Car",
    "Shopping",
    "Transport",
    "Travel",
    "Entertainment",
    "Health",
    "Grocery",
    "Pet",
    "Education",
    "Electronics",
    "Beauty",
    "Sports"
  ];
  res.json({ categories });
};

exports.getGoals = async (req, res) => {
  const goals = [
    "Retirement",
    "Housing",
    "Business",
    "Education",
    "Vacation"
  ];
  res.json({ goals });
};

// Get current user's monthly income and total savings
exports.getIncome = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user finances data
    const { data, error } = await supabase
      .from('user_finances')
      .select('monthly_income, monthly_expense, selected_category, goal_to_achieve, amount_to_save, today_spend, transaction')
      .eq('user_id', userId)
      .single();
    
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'No income data found for user' });

    // Calculate total savings from goals
    let totalSavings = 0;
    
    // Get all goals for the user
    const { data: goals, error: goalsError } = await supabase
      .from('goals')
      .select('id')
      .eq('user_id', userId);

    if (!goalsError && goals && goals.length > 0) {
      const goalIds = goals.map(goal => goal.id);
      
      // Get all savings for these goals
      const { data: savings, error: savingsError } = await supabase
        .from('savings')
        .select('amount_saved')
        .in('goal_id', goalIds);

      if (!savingsError && savings) {
        totalSavings = savings.reduce((sum, saving) => sum + parseFloat(saving.amount_saved), 0);
      }
    }

    res.json({ 
      monthly_income: data.monthly_income, 
      monthly_expense: data.monthly_expense, 
      selected_category: data.selected_category, 
      goal_to_achieve: data.goal_to_achieve, 
      amount_to_save: data.amount_to_save, 
      today_spend: data.today_spend, 
      transaction: data.transaction,
      total_savings: totalSavings
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get user finance status and missing fields
exports.getUserFinanceStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const { data, error } = await supabase
      .from('user_finances')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error) {
      // User finance record doesn't exist
      return res.json({
        is_missing: true,
        content_missing: [
          "monthly_income",
          "monthly_expense", 
          "selected_category",
          "goal_to_achieve",
          "amount_to_save",
          "today_spend",
          "transaction"
        ]
      });
    }

    // Check which fields are missing (null or 0)
    const missingFields = [];
    if (!data.monthly_income || data.monthly_income === 0) missingFields.push("monthly_income");
    if (!data.monthly_expense || data.monthly_expense === 0) missingFields.push("monthly_expense");
    if (!data.selected_category) missingFields.push("selected_category");
    if (!data.goal_to_achieve) missingFields.push("goal_to_achieve");
    if (!data.amount_to_save || data.amount_to_save === 0) missingFields.push("amount_to_save");
    if (!data.today_spend || data.today_spend === 0) missingFields.push("today_spend");
    if (!data.transaction) missingFields.push("transaction");

    res.json({
      is_missing: missingFields.length > 0,
      content_missing: missingFields,
      user_finances: data
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update transaction
exports.updateTransaction = async (req, res) => {
  try {
    const userId = req.user.id;
    const { transactionId } = req.params;
    const { amount, type, title, description, category, date } = req.body;

    // First check if the transaction exists and belongs to the user
    const { data: existingTransaction, error: checkError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .eq('user_id', userId)
      .single();

    if (checkError || !existingTransaction) {
      return res.status(404).json({ error: 'Transaction not found or access denied' });
    }

    // Build update object with only provided fields
    const updateData = {};

    if (amount !== undefined) updateData.amount = amount;
    if (type !== undefined) updateData.type = type;
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (category !== undefined) updateData.category = category;
    if (date !== undefined) updateData.date = date;

    // Update the transaction
    const { data, error } = await supabase
      .from('transactions')
      .update(updateData)
      .eq('id', transactionId)
      .eq('user_id', userId)
      .select('*')
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ 
      message: 'Transaction updated successfully',
      transaction: data 
    });

  } catch (err) {
    console.error('Error updating transaction:', err);
    res.status(500).json({ error: err.message });
  }
};

// Delete transaction
exports.deleteTransaction = async (req, res) => {
  try {
    const userId = req.user.id;
    const { transactionId } = req.params;

    // First check if the transaction exists and belongs to the user
    const { data: existingTransaction, error: checkError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .eq('user_id', userId)
      .single();

    if (checkError || !existingTransaction) {
      return res.status(404).json({ error: 'Transaction not found or access denied' });
    }

    // Delete the transaction
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', transactionId)
      .eq('user_id', userId);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ 
      message: 'Transaction deleted successfully',
      deleted_transaction_id: transactionId
    });

  } catch (err) {
    console.error('Error deleting transaction:', err);
    res.status(500).json({ error: err.message });
  }
}; 