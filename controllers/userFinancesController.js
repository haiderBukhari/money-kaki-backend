const supabase = require('../supabaseClient');
const { askClaude } = require('../utils/textagent');

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
    if (monthly_income == null) return res.status(400).json({ error: 'monthly_income required' });
    await getOrCreateUserFinances(userId);
    const { data, error } = await supabase
      .from('user_finances')
      .update({ monthly_income })
      .eq('user_id', userId)
      .select('*')
      .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ user_finances: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.addMonthlyExpense = async (req, res) => {
  try {
    const userId = req.user.id;
    const { monthly_expense } = req.body;
    if (monthly_expense == null) return res.status(400).json({ error: 'monthly_expense required' });
    await getOrCreateUserFinances(userId);
    const { data, error } = await supabase
      .from('user_finances')
      .update({ monthly_expense })
      .eq('user_id', userId)
      .select('*')
      .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ user_finances: data });
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
    if (amount_to_save == null) return res.status(400).json({ error: 'amount_to_save required' });
    await getOrCreateUserFinances(userId);
    const { data, error } = await supabase
      .from('user_finances')
      .update({ amount_to_save })
      .eq('user_id', userId)
      .select('*')
      .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ user_finances: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.addTodaySpend = async (req, res) => {
  try {
    const userId = req.user.id;
    const { today_spend } = req.body;
    if (today_spend == null) return res.status(400).json({ error: 'today_spend required' });
    await getOrCreateUserFinances(userId);
    const { data, error } = await supabase
      .from('user_finances')
      .update({ today_spend })
      .eq('user_id', userId)
      .select('*')
      .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ user_finances: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.addTransaction = async (req, res) => {
  try {
    const userId = req.user.id;
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
    res.status(201).json({ transactions: data });
  } catch (err) {
    res.status(400).json({ error: err.message });
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

// Get current user's monthly income
exports.getIncome = async (req, res) => {
  try {
    const userId = req.user.id;
    const { data, error } = await supabase
      .from('user_finances')
      .select('monthly_income')
      .eq('user_id', userId)
      .single();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'No income data found for user' });
    res.json({ monthly_income: data.monthly_income });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}; 