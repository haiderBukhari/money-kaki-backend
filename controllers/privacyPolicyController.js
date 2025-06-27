const supabase = require('../supabaseClient');

// Create Privacy Policy
exports.createPrivacyPolicy = async (req, res) => {
  const { content } = req.body;
  if (!content) {
    return res.status(400).json({ error: 'Content is required' });
  }
  const { data, error } = await supabase
    .from('privacy_policy')
    .insert([{ content }])
    .select();
  if (error) {
    return res.status(500).json({ error: error.message });
  }
  res.status(201).json({ message: 'Privacy Policy created', policy: data[0] });
};

// Get Latest Privacy Policy
exports.getLatestPrivacyPolicy = async (req, res) => {
  const { data, error } = await supabase
    .from('privacy_policy')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) {
    return res.status(500).json({ error: error.message });
  }
  if (!data || data.length === 0) {
    return res.status(404).json({ error: 'No privacy policy found' });
  }
  res.json({ policy: data[0] });
}; 