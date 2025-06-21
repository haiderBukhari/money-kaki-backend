const supabase = require('../supabaseClient');

// Create a new wrapping
exports.createWrapping = async (req, res) => {
  const { image } = req.body;
  if (!image) {
    return res.status(400).json({ error: 'Image is required' });
  }
  try {
    const { data, error } = await supabase
      .from('wrappings')
      .insert([{ image }])
      .select();
    if (error) throw error;
    res.status(201).json({ wrapping: data[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all wrappings
exports.getAllWrappings = async (req, res) => {
  try {
    const { data, error } = await supabase.from('wrappings').select('*');
    if (error) throw error;
    res.json({ wrappings: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get wrapping by ID
exports.getWrappingById = async (req, res) => {
  const { id } = req.params;
  try {
    const { data, error } = await supabase.from('wrappings').select('*').eq('id', id).single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Wrapping not found' });
    res.json({ wrapping: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete wrapping
exports.deleteWrapping = async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase.from('wrappings').delete().eq('id', id);
    if (error) throw error;
    res.json({ message: 'Wrapping deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}; 