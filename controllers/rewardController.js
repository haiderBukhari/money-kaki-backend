const supabase = require('../supabaseClient');

// Create a new reward (no codes)
exports.createReward = async (req, res) => {
  const { picture, name, price } = req.body;
  if (!picture || !name || !price) {
    return res.status(400).json({ error: 'Picture, name, and price are required' });
  }
  try {
    const { data, error } = await supabase
      .from('rewards')
      .insert([{ picture, name, price }])
      .select();
    if (error) throw error;
    res.status(201).json({ reward: data[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all rewards
exports.getAllRewards = async (req, res) => {
  try {
    const { data, error } = await supabase.from('rewards').select('*');
    if (error) throw error;
    res.json({ rewards: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get reward by ID
exports.getRewardById = async (req, res) => {
  const { id } = req.params;
  try {
    const { data, error } = await supabase.from('rewards').select('*').eq('id', id).single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Reward not found' });
    res.json({ reward: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update reward details (picture, name, price)
exports.updateReward = async (req, res) => {
  const { id } = req.params;
  const { picture, name, price } = req.body;
  const updateFields = {};
  if (picture) updateFields.picture = picture;
  if (name) updateFields.name = name;
  if (price) updateFields.price = price;

  if (Object.keys(updateFields).length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }
  updateFields.updated_at = new Date().toISOString();

  try {
    const { data, error } = await supabase.from('rewards').update(updateFields).eq('id', id).select();
    if (error) throw error;
    res.json({ reward: data[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete reward
exports.deleteReward = async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase.from('rewards').delete().eq('id', id);
    if (error) throw error;
    res.json({ message: 'Reward deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Add a single code to a reward's codes array
exports.addRewardCode = async (req, res) => {
  const { id } = req.params;
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ error: 'Code is required' });
  }
  try {
    const { data: reward, error: fetchError } = await supabase.from('rewards').select('codes').eq('id', id).single();
    if (fetchError) throw fetchError;
    if (!reward) return res.status(404).json({ error: 'Reward not found' });
    const updatedCodes = [...(reward.codes || []), code];
    const { data: updatedReward, error: updateError } = await supabase.from('rewards').update({ codes: updatedCodes, updated_at: new Date().toISOString() }).eq('id', id).select();
    if (updateError) throw updateError;
    res.json({ message: 'Code added successfully', reward: updatedReward[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Add multiple codes (bulk) to a reward's codes array
exports.addRewardCodesBulk = async (req, res) => {
  const { id } = req.params;
  const { codes } = req.body;
  if (!Array.isArray(codes) || codes.length === 0) {
    return res.status(400).json({ error: 'Codes array is required' });
  }
  try {
    const { data: reward, error: fetchError } = await supabase.from('rewards').select('codes').eq('id', id).single();
    if (fetchError) throw fetchError;
    if (!reward) return res.status(404).json({ error: 'Reward not found' });
    const updatedCodes = [...(reward.codes || []), ...codes];
    const { data: updatedReward, error: updateError } = await supabase.from('rewards').update({ codes: updatedCodes, updated_at: new Date().toISOString() }).eq('id', id).select();
    if (updateError) throw updateError;
    res.json({ message: 'Codes added successfully', reward: updatedReward[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Remove a code from a reward's codes array
exports.removeRewardCode = async (req, res) => {
    const { id } = req.params;
    const { code } = req.body;
    if (!code) {
        return res.status(400).json({ error: 'Code is required' });
    }
    try {
        const { data: reward, error: fetchError } = await supabase.from('rewards').select('codes').eq('id', id).single();
        if (fetchError) throw fetchError;
        if (!reward) return res.status(404).json({ error: 'Reward not found' });

        const updatedCodes = (reward.codes || []).filter(c => c !== code);
        if (updatedCodes.length === reward.codes.length) {
            return res.status(404).json({ error: 'Code not found in reward' });
        }

        const { data: updatedReward, error: updateError } = await supabase.from('rewards').update({ codes: updatedCodes, updated_at: new Date().toISOString() }).eq('id', id).select();
        if (updateError) throw updateError;
        res.json({ message: 'Code removed successfully', reward: updatedReward[0] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}; 