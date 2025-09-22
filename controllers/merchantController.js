const supabase = require('../supabaseClient');

// Create a new merchant
exports.createMerchant = async (req, res) => {
  const { image, name, discount, points, quantity, code, category, description, location } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }
  try {
    const { data, error } = await supabase
      .from('merchants')
      .insert([
        { image, name, discount, points, quantity, code, category, description, location }
      ])
      .select();
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.status(201).json({ merchant: data[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all merchants
exports.getAllMerchants = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('merchants')
      .select('*');
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.json({ merchants: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get merchant by ID
exports.getMerchantById = async (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ error: 'Merchant id is required' });
  }
  try {
    const { data, error } = await supabase
      .from('merchants')
      .select('*')
      .eq('id', id)
      .single();
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    if (!data) {
      return res.status(404).json({ error: 'Merchant not found' });
    }
    res.json({ merchant: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update merchant
exports.updateMerchant = async (req, res) => {
  const { id } = req.params;
  const updateFields = req.body;
  if (!id) {
    return res.status(400).json({ error: 'Merchant id is required' });
  }
  if (!updateFields || Object.keys(updateFields).length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }
  try {
    updateFields.updated_at = new Date().toISOString();
    const { data, error } = await supabase
      .from('merchants')
      .update(updateFields)
      .eq('id', id)
      .select();
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.json({ merchant: data[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete merchant
exports.deleteMerchant = async (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ error: 'Merchant id is required' });
  }
  try {
    const { error } = await supabase
      .from('merchants')
      .delete()
      .eq('id', id);
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.json({ message: 'Merchant deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all merchants where quantity > 0, with per-user availability
exports.getAllAvailableMerchants = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get all merchants with quantity > 0
    const { data: merchants, error: merchantsError } = await supabase
      .from('merchants')
      .select('*')
      .gt('quantity', 0);
    
    if (merchantsError) {
      return res.status(500).json({ error: merchantsError.message });
    }

    // Get user's redemption history
    const { data: userRedemptions, error: redemptionError } = await supabase
      .from('merchant_redeem')
      .select('merchant_id, redeem_count')
      .eq('user_id', userId);

    if (redemptionError) {
      return res.status(500).json({ error: redemptionError.message });
    }

    // Create a map of merchant_id to redeem_count
    const redemptionMap = {};
    userRedemptions.forEach(redemption => {
      redemptionMap[redemption.merchant_id] = redemption.redeem_count;
    });

    // Calculate available quantity for each merchant
    const availableMerchants = (merchants || []).map(merchant => {
      const { code, ...merchantData } = merchant;
      const userRedeemCount = redemptionMap[merchant.id] || 0;
      const availableQuantity = Math.max(0, merchant.quantity - userRedeemCount);
      
      return {
        ...merchantData,
        available_quantity: availableQuantity,
        user_redeemed_count: userRedeemCount
      };
    }).filter(merchant => merchant.available_quantity > 0); // Only show merchants with available quantity

    res.json({ merchants: availableMerchants });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Redeem a merchant for the current user
exports.redeemMerchant = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'Merchant id is required' });
    
    // Get merchant
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('*')
      .eq('id', id)
      .single();
    if (merchantError) return res.status(500).json({ error: merchantError.message });
    if (!merchant) return res.status(404).json({ error: 'Merchant not found' });
    if (merchant.quantity <= 0) return res.status(400).json({ error: 'Merchant is out of stock' });
    
    // Get user's redemption count for this merchant
    const { data: userRedemption, error: redemptionError } = await supabase
      .from('merchant_redeem')
      .select('redeem_count')
      .eq('user_id', userId)
      .eq('merchant_id', id)
      .single();
    
    if (redemptionError && redemptionError.code !== 'PGRST116') {
      return res.status(500).json({ error: redemptionError.message });
    }
    
    const currentRedeemCount = userRedemption ? userRedemption.redeem_count : 0;
    
    // Check if user has reached the redemption limit
    if (currentRedeemCount >= merchant.quantity) {
      return res.status(400).json({ error: 'You have reached the maximum redemption limit for this merchant' });
    }
    
    // Get user points
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('points')
      .eq('id', userId)
      .single();
    if (userError) return res.status(500).json({ error: userError.message });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.points < merchant.points) return res.status(400).json({ error: 'Not enough points to redeem this merchant' });
    
    // Update or insert redemption record
    const newRedeemCount = currentRedeemCount + 1;
    let redemptionUpdateError;
    
    if (userRedemption) {
      // Update existing record
      const { error } = await supabase
        .from('merchant_redeem')
        .update({ 
          redeem_count: newRedeemCount,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('merchant_id', id);
      redemptionUpdateError = error;
    } else {
      // Insert new record
      const { error } = await supabase
        .from('merchant_redeem')
        .insert({
          user_id: userId,
          merchant_id: id,
          redeem_count: 1
        });
      redemptionUpdateError = error;
    }
    
    if (redemptionUpdateError) {
      return res.status(500).json({ error: redemptionUpdateError.message });
    }
    
    // Deduct points from user
    const { data: updatedUser, error: updateUserError } = await supabase
      .from('users')
      .update({ points: user.points - merchant.points })
      .eq('id', userId)
      .select();
    if (updateUserError) return res.status(500).json({ error: updateUserError.message });
    
    res.json({ 
      message: 'Merchant redeemed successfully', 
      merchant: merchant,
      user_redeemed_count: newRedeemCount,
      remaining_quantity: merchant.quantity - newRedeemCount,
      points_deducted: merchant.points,
      remaining_points: updatedUser[0].points
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}; 