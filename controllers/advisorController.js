const supabase = require('../supabaseClient');
const { sendAdvisorVerificationEmail } = require('./emailService');

// Helper to generate a random email code
function generateEmailCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

exports.createAdvisor = async (req, res) => {
  const { full_name, email_address, contact_number } = req.body;
  if (!full_name || !email_address || !contact_number) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Check if user exists
  const { data: existingUser, error: findError } = await supabase
    .from('users')
    .select('id')
    .eq('email_address', email_address)
    .single();

  if (existingUser) {
    return res.status(409).json({ error: 'User already exists with this email' });
  }

  const email_code = generateEmailCode();

  // Insert new advisor
  const { data, error } = await supabase
    .from('users')
    .insert([
      {
        full_name,
        email_address,
        contact_number,
        email_code,
        role: 'advisor'
      },
    ])
    .select();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  // Send verification email
  const emailResult = await sendAdvisorVerificationEmail(full_name, email_address, email_code);
  if (emailResult.error) {
    return res.status(500).json({ error: emailResult.error });
  }

  res.status(201).json({ message: 'Advisor created. Verification code sent to email.', advisor: data[0] });
};

exports.verifyEmail = async (req, res) => {
  const { email_address, email_code } = req.body;
  if (!email_address || !email_code) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const { data: user, error } = await supabase
    .from('users')
    .select('id, email_code')
    .eq('email_address', email_address)
    .single();

  if (!user || user.email_code !== email_code) {
    return res.status(400).json({ error: 'Invalid code or email' });
  }

  // Optionally update status here
  // await supabase.from('users').update({ status: 'verified' }).eq('id', user.id);

  res.json({ message: 'Email verified successfully' });
};

exports.createPassword = async (req, res) => {
  const { email_address, password } = req.body;
  if (!email_address || !password) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Optionally hash password here
  const { data, error } = await supabase
    .from('users')
    .update({ password })
    .eq('email_address', email_address)
    .select();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ message: 'Password set successfully', advisor: data[0] });
};

exports.getAllAdvisors = async (req, res) => {
  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, email_address, contact_number, status, credits, points, profile_picture, vocher_quantity')
    .eq('role', 'advisor')
    .eq('status', 'active');

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ advisors: data });
};

exports.deleteAdvisor = async (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ error: 'Advisor id is required' });
  }

  const { error } = await supabase
    .from('users')
    .delete()
    .eq('id', id);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ message: 'Advisor deleted successfully' });
};

exports.editAdvisor = async (req, res) => {
  const { id } = req.params;
  const updateFields = req.body;
  if (!id) {
    return res.status(400).json({ error: 'Advisor id is required' });
  }
  if (!updateFields || Object.keys(updateFields).length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  const { data, error } = await supabase
    .from('users')
    .update(updateFields)
    .eq('id', id)
    .select();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ message: 'Advisor updated successfully', advisor: data[0] });
};

exports.getAdvisorById = async (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ error: 'Advisor id is required' });
  }

  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, email_address, contact_number, status, credits, points, profile_picture, vocher_quantity')
    .eq('id', id)
    .eq('role', 'advisor')
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }
  if (!data) {
    return res.status(404).json({ error: 'Advisor not found' });
  }

  res.json({ advisor: data });
};

exports.getInactiveAdvisors = async (req, res) => {
  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, email_address, contact_number, status, credits, points, profile_picture, vocher_quantity')
    .eq('role', 'advisor')
    .eq('status', 'inactive');

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ advisors: data });
};

exports.toggleAdvisorStatus = async (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ error: 'Advisor id is required' });
  }

  // Get current status
  const { data: advisor, error: getError } = await supabase
    .from('users')
    .select('status')
    .eq('id', id)
    .eq('role', 'advisor')
    .single();

  if (getError) {
    return res.status(500).json({ error: getError.message });
  }
  if (!advisor) {
    return res.status(404).json({ error: 'Advisor not found' });
  }

  const newStatus = advisor.status === 'active' ? 'inactive' : 'active';

  const { data, error } = await supabase
    .from('users')
    .update({ status: newStatus })
    .eq('id', id)
    .select();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ message: `Advisor status updated to ${newStatus}`, advisor: data[0] });
};

exports.loginAdvisor = async (req, res) => {
  const { email, password } = req.query;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const { data: advisor, error } = await supabase
    .from('users')
    .select('id, full_name, email_address, contact_number, status, credits, points, profile_picture, vocher_quantity, role')
    .eq('email_address', email)
    .eq('password', password)
    .eq('role', 'advisor')
    .single();

  if (!advisor || (error && error.code === 'PGRST116')) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  // For other errors, return 500
  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ advisor });
}; 