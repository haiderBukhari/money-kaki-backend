const supabase = require('../supabaseClient');

// Create a new merchant
exports.createMerchant = async (req, res) => {
  const { image, name, discount, points, quantity, code } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }
  try {
    const { data, error } = await supabase
      .from('merchants')
      .insert([
        { image, name, discount, points, quantity, code }
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