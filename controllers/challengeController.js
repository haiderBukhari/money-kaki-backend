const supabase = require('../supabaseClient');

// Create a new challenge
exports.createChallenge = async (req, res) => {
  const { user_id, challenge_title, reward_id, quantity, overall_price, points } = req.body;
  if (!user_id || !challenge_title) {
    return res.status(400).json({ error: 'User ID and challenge title are required' });
  }

  const created_by = req.user.id; // Get from JWT token

  // Build insert object with only provided fields
  const insertObj = { user_id, challenge_title, created_by };
  if (reward_id !== undefined) insertObj.reward_id = reward_id;
  if (quantity !== undefined) insertObj.quantity = quantity;
  if (overall_price !== undefined) insertObj.overall_price = overall_price;
  if (points !== undefined) insertObj.points = points;

  try {
    const { data, error } = await supabase
      .from('challenges')
      .insert([insertObj])
      .select();

    if (error) throw error;
    res.status(201).json({ challenge: data[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all challenges
exports.getAllChallenges = async (req, res) => {
  try {
    const { created_by } = req.query; // Get created_by from query parameter
    
    let query = supabase
      .from('challenges')
      .select(`
        *,
        users (
          id,
          full_name,
          email_address
        )
      `)
      .order('created_at', { ascending: false });

    // Filter by created_by if provided, otherwise use authenticated user's ID
    if (created_by) {
      query = query.eq('created_by', created_by);
    } else if (req.user && req.user.id) {
      // If no created_by parameter, filter by authenticated user
      query = query.eq('created_by', req.user.id);
    }

    const { data, error } = await query;

    if (error) throw error;
    res.json({ challenges: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get challenges by user ID
exports.getChallengesByUserId = async (req, res) => {
  const { user_id } = req.params;
  if (!user_id) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  try {
    const { data, error } = await supabase
      .from('challenges')
      .select(`
        *,
        users (
          id,
          full_name,
          email_address
        )
      `)
      .eq('created_by', user_id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ challenges: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get challenge by ID
exports.getChallengeById = async (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ error: 'Challenge ID is required' });
  }

  try {
    const { data, error } = await supabase
      .from('challenges')
      .select(`
        *,
        users (
          id,
          full_name,
          email_address
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Challenge not found' });
    res.json({ challenge: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update challenge
exports.updateChallenge = async (req, res) => {
  const { id } = req.params;
  const { challenge_title } = req.body;
  
  if (!id) {
    return res.status(400).json({ error: 'Challenge ID is required' });
  }
  
  if (!challenge_title) {
    return res.status(400).json({ error: 'Challenge title is required' });
  }

  try {
    const { data, error } = await supabase
      .from('challenges')
      .update({ challenge_title })
      .eq('id', id)
      .select();

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Challenge not found' });
    }
    res.json({ challenge: data[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete challenge
exports.deleteChallenge = async (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ error: 'Challenge ID is required' });
  }

  try {
    const { error } = await supabase
      .from('challenges')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ message: 'Challenge deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}; 