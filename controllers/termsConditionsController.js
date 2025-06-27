const supabase = require('../supabaseClient');

// Create Terms & Conditions
exports.createTermsConditions = async (req, res) => {
  const { content } = req.body;
  if (!content) {
    return res.status(400).json({ error: 'Content is required' });
  }
  const { data, error } = await supabase
    .from('terms_conditions')
    .insert([{ content }])
    .select();
  if (error) {
    return res.status(500).json({ error: error.message });
  }
  res.status(201).json({ message: 'Terms & Conditions created', terms: data[0] });
};

// Get Latest Terms & Conditions
exports.getLatestTermsConditions = async (req, res) => {
  const { data, error } = await supabase
    .from('terms_conditions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) {
    return res.status(500).json({ error: error.message });
  }
  if (!data || data.length === 0) {
    return res.status(404).json({ error: 'No terms & conditions found' });
  }
  res.json({ terms: data[0] });
}; 