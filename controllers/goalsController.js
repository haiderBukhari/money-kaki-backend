const supabase = require('../supabaseClient');

// GOALS CRUD
exports.createGoal = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount_to_save, goal_for, deadline } = req.body;
    if (!amount_to_save || !goal_for || !deadline) return res.status(400).json({ error: 'All fields required' });
    const { data, error } = await supabase
      .from('goals')
      .insert({ user_id: userId, amount_to_save, goal_for, deadline })
      .select('*');
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json({ goal: data[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getGoals = async (req, res) => {
  try {
    const userId = req.user.id;
    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ goals: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateGoal = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { amount_to_save, goal_for, deadline } = req.body;
    if (!id) return res.status(400).json({ error: 'Goal id required' });
    const { data, error } = await supabase
      .from('goals')
      .update({ amount_to_save, goal_for, deadline })
      .eq('id', id)
      .eq('user_id', userId)
      .select('*');
    if (error) return res.status(500).json({ error: error.message });
    res.json({ goal: data[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteGoal = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'Goal id required' });
    const { error } = await supabase
      .from('goals')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: 'Goal deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// SAVINGS CRUD
exports.createSaving = async (req, res) => {
  try {
    const { goal_id, amount_saved, title } = req.body;
    if (!goal_id || !amount_saved || !title) return res.status(400).json({ error: 'All fields required' });
    const { data, error } = await supabase
      .from('savings')
      .insert({ goal_id, amount_saved, title })
      .select('*');
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json({ saving: data[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getSavings = async (req, res) => {
  try {
    const { goal_id } = req.params;
    if (!goal_id) return res.status(400).json({ error: 'goal_id required' });
    const { data, error } = await supabase
      .from('savings')
      .select('*')
      .eq('goal_id', goal_id)
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ savings: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateSaving = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount_saved, title } = req.body;
    if (!id) return res.status(400).json({ error: 'Saving id required' });
    const { data, error } = await supabase
      .from('savings')
      .update({ amount_saved, title })
      .eq('id', id)
      .select('*');
    if (error) return res.status(500).json({ error: error.message });
    res.json({ saving: data[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteSaving = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'Saving id required' });
    const { error } = await supabase
      .from('savings')
      .delete()
      .eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: 'Saving deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}; 