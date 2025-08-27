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
          first_name,
          last_name,
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

    data.forEach(challenge => {
      challenge.users.full_name = challenge.users.full_name ? challenge.users.full_name : `${challenge.users.first_name} ${challenge.users.last_name}`;
    });

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

// Get user challenges with points or rewards (redeemable challenges)
exports.getUserRedeemableChallenges = async (req, res) => {
  const userId = req.user.id; // Get from JWT token

  try {
    const { data, error } = await supabase
      .from('challenges')
      .select(`
        *,
        rewards (
          id,
          name,
          picture,
          price
        )
      `)
      .eq('user_id', userId)
      .or('points.gt.0,reward_id.not.is.null')
      .eq('is_redeemed', false)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ challenges: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Redeem a challenge
exports.redeemChallenge = async (req, res) => {
  const { challenge_id } = req.body;
  const userId = req.user.id; // Get from JWT token

  if (!challenge_id) {
    return res.status(400).json({ error: 'Challenge ID is required' });
  }

  try {
    // First, get the challenge to verify it belongs to the user and check if it's redeemable
    const { data: challenge, error: challengeError } = await supabase
      .from('challenges')
      .select('*')
      .eq('id', challenge_id)
      .eq('user_id', userId)
      .single();

    if (challengeError) {
      return res.status(404).json({ error: 'Challenge not found or access denied' });
    }

    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found' });
    }

    // Check if challenge is already redeemed
    if (challenge.is_redeemed) {
      return res.status(400).json({ error: 'Challenge is already redeemed' });
    }

    // Check if challenge has points or reward_id
    if (!challenge.points && !challenge.reward_id) {
      return res.status(400).json({ error: 'Challenge has no points or rewards to redeem' });
    }

    // Start a transaction-like process
    let pointsToAdd = 0;
    let rewardInfo = null;
    let user = null;

    // If challenge has points, add them to user
    if (challenge.points && challenge.points > 0) {
      pointsToAdd = challenge.points;
    }

    // If challenge has a reward, get reward details and handle advisor approval
    if (challenge.reward_id) {
      const { data: reward, error: rewardError } = await supabase
        .from('rewards')
        .select('id, name, picture, price')
        .eq('id', challenge.reward_id)
        .single();

      if (rewardError) {
        return res.status(500).json({ error: 'Error fetching reward details' });
      }

      rewardInfo = reward;

      // For reward challenges, set sent_to_advisor to true and return early
      // Don't mark as redeemed yet - wait for advisor approval
      const { error: updateSentToAdvisorError } = await supabase
        .from('challenges')
        .update({ sent_to_advisor: true })
        .eq('id', challenge_id);

      if (updateSentToAdvisorError) {
        return res.status(500).json({ error: 'Error updating challenge status' });
      }

      // Return success response for reward challenges (pending advisor approval)
      return res.json({
        message: 'Challenge sent to advisor for approval',
        challenge_id: challenge_id,
        points_awarded: 0,
        reward: rewardInfo,
        new_total_points: null,
        status: 'pending_advisor_approval'
      });
    }

    // Update user points if there are points to add
    if (pointsToAdd > 0) {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('points')
        .eq('id', userId)
        .single();

      if (userError) {
        return res.status(500).json({ error: 'Error fetching user data' });
      }

      user = userData;
      const currentPoints = user.points || 0;
      const newPoints = currentPoints + pointsToAdd;

      const { error: updateUserError } = await supabase
        .from('users')
        .update({ points: newPoints })
        .eq('id', userId);

      if (updateUserError) {
        return res.status(500).json({ error: 'Error updating user points' });
      }
    }

    // Mark challenge as redeemed
    const { error: updateChallengeError } = await supabase
      .from('challenges')
      .update({ is_redeemed: true })
      .eq('id', challenge_id);

    if (updateChallengeError) {
      return res.status(500).json({ error: 'Error updating challenge status' });
    }

    // Return success response with details
    res.json({
      message: 'Challenge redeemed successfully',
      challenge_id: challenge_id,
      points_awarded: pointsToAdd,
      reward: rewardInfo,
      new_total_points: pointsToAdd > 0 ? (user?.points || 0) + pointsToAdd : null
    });

  } catch (error) {
    console.error('Error redeeming challenge:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get user's redeemed challenges
exports.getUserRedeemedChallenges = async (req, res) => {
  const userId = req.user.id; // Get from JWT token

  try {
    const { data, error } = await supabase
      .from('challenges')
      .select(`
        *,
        rewards (
          id,
          name,
          picture,
          price
        )
      `)
      .eq('user_id', userId)
      .eq('is_redeemed', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ challenges: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}; 