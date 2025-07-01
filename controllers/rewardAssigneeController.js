const supabase = require('../supabaseClient');

// Create a new reward assignee
exports.createRewardAssignee = async (req, res) => {
  const {
    assignee_id,
    schedule_type,
    date,
    reward_id,
    quantity = 1,
    wrapping_id,
    headline,
    greeting
  } = req.body;
  if (!assignee_id || !schedule_type || !reward_id) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const created_by = req.user.id;
    const { data, error } = await supabase
      .from('rewards_assignee')
      .insert([{ created_by, assignee_id, schedule_type, date, reward_id, quantity, wrapping_id, headline, greeting }])
      .select();
    if (error) throw error;
    res.status(201).json({ rewardAssignee: data[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all reward assignees
exports.getAllRewardAssignees = async (req, res) => {
  try {
    const { data, error } = await supabase.from('rewards_assignee').select('*');
    if (error) throw error;
    res.json({ rewardAssignees: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get reward assignee by ID
exports.getRewardAssigneeById = async (req, res) => {
  const { id } = req.params;
  try {
    const { data, error } = await supabase.from('rewards_assignee').select('*').eq('id', id).single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Reward assignee not found' });
    res.json({ rewardAssignee: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update reward assignee
exports.updateRewardAssignee = async (req, res) => {
  const { id } = req.params;
  const updateFields = req.body;
  if (Object.keys(updateFields).length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }
  updateFields.updated_at = new Date().toISOString();
  try {
    const { data, error } = await supabase.from('rewards_assignee').update(updateFields).eq('id', id).select();
    if (error) throw error;
    res.json({ rewardAssignee: data[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete reward assignee
exports.deleteRewardAssignee = async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase.from('rewards_assignee').delete().eq('id', id);
    if (error) throw error;
    res.json({ message: 'Reward assignee deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all reward assignees for the current user (assignee_id = req.user.id)
exports.getRewardAssigneesByAssignee = async (req, res) => {
  const assignee_id = req.user && req.user.id;
  if (!assignee_id) {
    return res.status(401).json({ error: 'Unauthorized: user id not found' });
  }
  try {
    const { data, error } = await supabase.from('rewards_assignee').select('*').eq('assignee_id', assignee_id);
    if (error) throw error;
    res.json({ rewardAssignees: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}; 