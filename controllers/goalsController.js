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
    const { data: goals, error } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) return res.status(500).json({ error: error.message });
    
    // Get savings for each goal
    const goalsWithSavings = await Promise.all(goals.map(async (goal) => {
      const { data: savings } = await supabase
        .from('savings')
        .select('amount_saved')
        .eq('goal_id', goal.id);
      
      const totalSaved = savings.reduce((sum, saving) => sum + (saving.amount_saved || 0), 0);
      const isExceeded = totalSaved > goal.amount_to_save;
      const exceededMessage = isExceeded ? "The amount you're saving has exceeded your target." : null;
      
      return {
        ...goal,
        total_saved: totalSaved,
        remaining_amount: Math.max(0, goal.amount_to_save - totalSaved),
        is_exceeded: isExceeded,
        exceeded_message: exceededMessage
      };
    }));
    
    res.json({ goals: goalsWithSavings });
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
    const { goal_id, amount_saved, title, save_in_wallet = false } = req.body;
    if (!goal_id || !amount_saved || !title) return res.status(400).json({ error: 'All fields required' });
    
    const userId = req.user.id;
    
    // Get current user finances (needed for response regardless of save_in_wallet)
    const { data: userFinances, error: financeError } = await supabase
      .from('user_finances')
      .select('wallet')
      .eq('user_id', userId)
      .single();
    
    if (financeError) {
      return res.status(500).json({ error: 'Error fetching user finances' });
    }
    
    if (save_in_wallet) {
      const currentWallet = userFinances?.wallet || 0;
      
      // Deduct amount from wallet (allows negative balance)
      const newWalletAmount = currentWallet - amount_saved;
      const { error: updateError } = await supabase
        .from('user_finances')
        .update({ wallet: newWalletAmount })
        .eq('user_id', userId);
      
      if (updateError) {
        return res.status(500).json({ error: 'Error updating wallet' });
      }
    }
    
    // Create the saving
    const { data: saving, error } = await supabase
      .from('savings')
      .insert({ goal_id, amount_saved, title, save_in_wallet })
      .select('*');
    
    if (error) return res.status(500).json({ error: error.message });
    
    // Get updated goal information with savings
    const { data: goal } = await supabase
      .from('goals')
      .select('*')
      .eq('id', goal_id)
      .single();
    
    const { data: allSavings } = await supabase
      .from('savings')
      .select('amount_saved')
      .eq('goal_id', goal_id);
    
    const totalSaved = allSavings.reduce((sum, s) => sum + (s.amount_saved || 0), 0);
    const isExceeded = totalSaved > goal.amount_to_save;
    const exceededMessage = isExceeded ? "The amount you're saving has exceeded your target." : null;
    
    // Get updated wallet amount if save_in_wallet was true
    let updatedWallet = null;
    if (save_in_wallet) {
      const { data: updatedFinances } = await supabase
        .from('user_finances')
        .select('wallet')
        .eq('user_id', userId)
        .single();
      updatedWallet = updatedFinances?.wallet || 0;
    }
    
    res.status(201).json({ 
      saving: saving[0],
      goal: {
        ...goal,
        total_saved: totalSaved,
        remaining_amount: Math.max(0, goal.amount_to_save - totalSaved),
        is_exceeded: isExceeded,
        exceeded_message: exceededMessage
      },
      wallet: updatedWallet ? { 
        previous_amount: (userFinances?.wallet || 0) + amount_saved,
        current_amount: updatedWallet,
        deducted_amount: amount_saved
      } : null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getSavings = async (req, res) => {
  try {
    const { goal_id } = req.params;
    if (!goal_id) return res.status(400).json({ error: 'goal_id required' });
    
    // Get goal information
    const { data: goal, error: goalError } = await supabase
      .from('goals')
      .select('*')
      .eq('id', goal_id)
      .single();
    
    if (goalError) return res.status(500).json({ error: goalError.message });
    if (!goal) return res.status(404).json({ error: 'Goal not found' });
    
    const { data: savings, error: savingsError } = await supabase
      .from('savings')
      .select('*')
      .eq('goal_id', goal_id)
      .order('created_at', { ascending: false });
    
    if (savingsError) return res.status(500).json({ error: savingsError.message });
    
    // Calculate total savings
    const totalSaved = savings.reduce((sum, saving) => sum + (saving.amount_saved || 0), 0);
    
    // Check if savings exceed goal
    const isExceeded = totalSaved > goal.amount_to_save;
    const exceededMessage = isExceeded ? "The amount you're saving has exceeded your target." : null;
    
    res.json({ 
      savings: savings,
      goal: goal,
      total_saved: totalSaved,
      remaining_amount: Math.max(0, goal.amount_to_save - totalSaved),
      is_exceeded: isExceeded,
      exceeded_message: exceededMessage
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateSaving = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount_saved, title, save_in_wallet } = req.body;
    if (!id) return res.status(400).json({ error: 'Saving id required' });
    
    // Get the saving to find the goal_id
    const { data: existingSaving } = await supabase
      .from('savings')
      .select('goal_id')
      .eq('id', id)
      .single();
    
    if (!existingSaving) return res.status(404).json({ error: 'Saving not found' });
    
    // Update the saving
    const { data: saving, error } = await supabase
      .from('savings')
      .update({ amount_saved, title, save_in_wallet })
      .eq('id', id)
      .select('*');
    
    if (error) return res.status(500).json({ error: error.message });
    
    // Get updated goal information with savings
    const { data: goal } = await supabase
      .from('goals')
      .select('*')
      .eq('id', existingSaving.goal_id)
      .single();
    
    const { data: allSavings } = await supabase
      .from('savings')
      .select('amount_saved')
      .eq('goal_id', existingSaving.goal_id);
    
    const totalSaved = allSavings.reduce((sum, s) => sum + (s.amount_saved || 0), 0);
    const isExceeded = totalSaved > goal.amount_to_save;
    const exceededMessage = isExceeded ? "The amount you're saving has exceeded your target." : null;
    
    res.json({ 
      saving: saving[0],
      goal: {
        ...goal,
        total_saved: totalSaved,
        remaining_amount: Math.max(0, goal.amount_to_save - totalSaved),
        is_exceeded: isExceeded,
        exceeded_message: exceededMessage
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteSaving = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'Saving id required' });
    
    // Get the saving to find the goal_id before deleting
    const { data: existingSaving } = await supabase
      .from('savings')
      .select('goal_id')
      .eq('id', id)
      .single();
    
    if (!existingSaving) return res.status(404).json({ error: 'Saving not found' });
    
    // Delete the saving
    const { error } = await supabase
      .from('savings')
      .delete()
      .eq('id', id);
    
    if (error) return res.status(500).json({ error: error.message });
    
    // Get updated goal information with savings
    const { data: goal } = await supabase
      .from('goals')
      .select('*')
      .eq('id', existingSaving.goal_id)
      .single();
    
    const { data: allSavings } = await supabase
      .from('savings')
      .select('amount_saved')
      .eq('goal_id', existingSaving.goal_id);
    
    const totalSaved = allSavings.reduce((sum, s) => sum + (s.amount_saved || 0), 0);
    const isExceeded = totalSaved > goal.amount_to_save;
    const exceededMessage = isExceeded ? "The amount you're saving has exceeded your target." : null;
    
    res.json({ 
      message: 'Saving deleted',
      goal: {
        ...goal,
        total_saved: totalSaved,
        remaining_amount: Math.max(0, goal.amount_to_save - totalSaved),
        is_exceeded: isExceeded,
        exceeded_message: exceededMessage
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}; 