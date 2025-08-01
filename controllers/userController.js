const supabase = require('../supabaseClient');
const { sendAdvisorVerificationEmail, sendPasswordResetEmail } = require('./emailService');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');

const client = new OAuth2Client(
  process.env.OAUTH_CLIENT_ID,
  process.env.OAUTH_CLIENT_SECRET,
  process.env.REDIRECT_URI
);

function generateEmailCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

function generateResetCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Helper to get full_name from first_name and last_name
function getFullName(user) {
  if (!user) return '';
  if (user.first_name && user.last_name) return `${user.first_name} ${user.last_name}`;
  if (user.first_name) return user.first_name;
  if (user.last_name) return user.last_name;
  return '';
}

exports.createUser = async (req, res) => {
  const { first_name, last_name, email_address, country_code, number, referal_code } = req.body;
  if (!first_name || !last_name || !email_address || !country_code || !number) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const { data: existingUser, error: findError } = await supabase
    .from('users')
    .select('id')
    .eq('email_address', email_address)
    .single();

  if (existingUser) {
    return res.status(409).json({ error: 'User already exists with this email' });
  }

  // If referral code is provided, validate it
  let mentorId = null;
  if (referal_code) {
    const { data: mentor, error: mentorError } = await supabase
      .from('users')
      .select('id')
      .eq('referral', referal_code)
      .single();

    if (mentorError || !mentor) {
      return res.status(400).json({ error: 'Invalid referral code' });
    }
    mentorId = mentor.id;
  }

  const email_code = generateEmailCode();

  const { data, error } = await supabase
    .from('users')
    .insert([
      {
        first_name,
        last_name,
        email_address,
        country_code,
        number,
        email_code,
        role: 'user'
      },
    ])
    .select();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  if (mentorId) {
    const { error: assignmentError } = await supabase
      .from('assigned_users')
      .insert([
        {
          mentor_id: mentorId,
          user_id: data[0].id
        }
      ]);

    if (assignmentError) {
      await supabase.from('users').delete().eq('id', data[0].id);
      return res.status(500).json({ error: 'Failed to create user assignment' });
    }

    // Increment total_assigned for the advisor (referral assignment)
    const { data: advisor, error: advisorFetchError } = await supabase
      .from('users')
      .select('total_assigned')
      .eq('id', mentorId)
      .single();

    if (advisorFetchError) {
      // If we can't fetch advisor data, clean up the assignment
      await supabase.from('assigned_users').delete().eq('user_id', data[0].id);
      await supabase.from('users').delete().eq('id', data[0].id);
      return res.status(500).json({ error: 'Failed to fetch advisor data' });
    }

    const newTotalAssigned = (advisor.total_assigned || 0) + 1;
    const { error: updateError } = await supabase
      .from('users')
      .update({ total_assigned: newTotalAssigned })
      .eq('id', mentorId);

    if (updateError) {

      await supabase.from('assigned_users').delete().eq('user_id', data[0].id);
      await supabase.from('users').delete().eq('id', data[0].id);
      return res.status(500).json({ error: 'Failed to update advisor assignment count' });

    }
  } else {

    const { data: advisors, error: advisorError } = await supabase
      .from('users')
      .select('id, total_assigned, created_at')
      .eq('role', 'advisor')
      .eq('status', 'active')
      .order('total_assigned', { ascending: true })
      .order('created_at', { ascending: true });

    if (advisorError) {
      await supabase.from('users').delete().eq('id', data[0].id);
      return res.status(500).json({ error: 'Failed to find available advisors' });
    }

    if (advisors && advisors.length > 0) {
      const selectedAdvisor = advisors[0];

      const { error: assignmentError } = await supabase
        .from('assigned_users')
        .insert([
          {
            mentor_id: selectedAdvisor.id,
            user_id: data[0].id
          }
        ]);

      if (assignmentError) {
        await supabase.from('users').delete().eq('id', data[0].id);
        return res.status(500).json({ error: 'Failed to create automatic user assignment' });
      }

      // Increment total_assigned for the selected advisor
      const newTotalAssigned = (selectedAdvisor.total_assigned || 0) + 1;
      const { error: updateError } = await supabase
        .from('users')
        .update({ total_assigned: newTotalAssigned })
        .eq('id', selectedAdvisor.id);

      if (updateError) {
        // If update fails, we should clean up the assignment
        await supabase.from('assigned_users').delete().eq('user_id', data[0].id);
        await supabase.from('users').delete().eq('id', data[0].id);
        return res.status(500).json({ error: 'Failed to update advisor assignment count' });
      }

      mentorId = selectedAdvisor.id;
    }
  }

  const emailResult = await sendAdvisorVerificationEmail(first_name, email_address, email_code);
  if (emailResult.error) {
    return res.status(500).json({ error: emailResult.error });
  }

  res.status(201).json({ 
    message: 'User created. Verification code sent to email.', 
  });
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

  // Generate a 10-digit secret
  const secret = Math.floor(1000000000 + Math.random() * 9000000000).toString();
  // Store secret in db
  const { error: updateError } = await supabase
    .from('users')
    .update({ secret })
    .eq('id', user.id);
  if (updateError) {
    return res.status(500).json({ error: 'Failed to save secret' });
  }

  res.json({ message: 'Email verified successfully', secret });
};

exports.createPassword = async (req, res) => {
  const { email_address, password, secret } = req.body;
  if (!email_address || !password || !secret) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Check secret
  const { data: user, error: findError } = await supabase
    .from('users')
    .select('id, secret, role, email_address')
    .eq('email_address', email_address)
    .single();
  if (!user || user.secret !== secret) {
    return res.status(400).json({ error: 'Invalid secret' });
  }

  // Update password
  const { error } = await supabase
    .from('users')
    .update({ password })
    .eq('email_address', email_address);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  // Fetch user with login fields
  const { data: userData, error: userFetchError } = await supabase
    .from('users')
    .select('id, first_name, last_name, email_address, country_code, number, status, credits, points, profile_picture, vocher_quantity, role, auth_source, password')
    .eq('email_address', email_address)
    .single();

  if (userFetchError) {
    return res.status(500).json({ error: userFetchError.message });
  }

  // Generate JWT token (like loginUser)
  const token = jwt.sign(
    {
      id: userData.id,
      role: userData.role,
      email: userData.email_address
    },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '30d' }
  );

  res.json({ message: 'Password set successfully', user: userData, token, role: userData.role });
};

exports.getAllUsers = async (req, res) => {
  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, email_address, contact_number, status, credits, points, profile_picture, vocher_quantity')
    .eq('role', 'user')
    .eq('status', 'active');

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ users: data });
};

exports.deleteUser = async (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ error: 'User id is required' });
  }

  const { error } = await supabase
    .from('users')
    .delete()
    .eq('id', id);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ message: 'User deleted successfully' });
};

exports.editUser = async (req, res) => {
  const { id } = req.params;
  const updateFields = req.body;
  if (!id) {
    return res.status(400).json({ error: 'User id is required' });
  }
  if (!updateFields || Object.keys(updateFields).length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  const numericFields = ['credits', 'points', 'vocher_quantity'];
  const processedFields = { ...updateFields };
  numericFields.forEach(field => {
    if (processedFields[field] === '') {
      processedFields[field] = null;
    }
  });

  const { data, error } = await supabase
    .from('users')
    .update(processedFields)
    .eq('id', id)
    .select();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ message: 'User updated successfully', user: data[0] });
};

exports.getUserById = async (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ error: 'User id is required' });
  }

  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, email_address, contact_number, status, credits, points, profile_picture, vocher_quantity')
    .eq('id', id)
    .eq('role', 'user')
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }
  if (!data) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({ user: data });
};

exports.getInactiveUsers = async (req, res) => {
  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, email_address, contact_number, status, credits, points, profile_picture, vocher_quantity, created_at')
    .eq('role', 'user')
    .eq('status', 'inactive');

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ users: data });
};

exports.toggleUserStatus = async (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ error: 'User id is required' });
  }

  const { data: user, error: getError } = await supabase
    .from('users')
    .select('status')
    .eq('id', id)
    .eq('role', 'user')
    .single();

  if (getError) {
    return res.status(500).json({ error: getError.message });
  }
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const newStatus = user.status === 'active' ? 'inactive' : 'active';

  const { data, error } = await supabase
    .from('users')
    .update({ status: newStatus })
    .eq('id', id)
    .select();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ message: `User status updated to ${newStatus}`, user: data[0] });
};

exports.loginUser = async (req, res) => {
  const { email, password } = req.query;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const { data: user, error: findError } = await supabase
    .from('users')
    .select('id, first_name, last_name, email_address, country_code, number, status, credits, points, profile_picture, vocher_quantity, role, auth_source, password')
    .eq('email_address', email)
    .single();

  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  if (user.auth_source === 'google') {
    return res.status(403).json({ 
      error: 'This account was created using Google Sign-In. Please use Google Sign-In to access your account.' 
    });
  }

  if (user.password !== password) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  if (findError) {
    return res.status(500).json({ error: findError.message });
  }

  const token = jwt.sign(
    { 
      id: user.id,
      role: user.role,
      email: user.email_address
    },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '30d' }
  );

  res.json({ message: 'Login successful', user, token, role: user.role });
};

exports.getRole = async (req, res) => {
  try {
    const { id, role } = req.user;
    const { data: user, error } = await supabase
      .from('users')
      .select('id, full_name, email_address, role, status, profile_picture')
      .eq('id', id)
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user.id,
      role: user.role,
      full_name: user.full_name,
      email_address: user.email_address,
      status: user.status,
      profile_picture: user.profile_picture
    });
  } catch (error) {
    res.status(500).json({ error: 'Error getting user role' });
  }
};

exports.oauthLogin = async (req, res) => {
  const { credential, redirect_uri } = req.body;

  if (!credential) {
    return res.status(400).json({ error: 'Credential is required' });
  }

  try {
    const { tokens } = await client.getToken({
      code: credential,
      redirect_uri: redirect_uri
    });

    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.OAUTH_CLIENT_ID
    });
    
    const payload = ticket.getPayload();
    const { email, given_name, family_name, picture } = payload;

    let { data: user, error: findError } = await supabase
      .from('users')
      .select('id, full_name, email_address, contact_number, status, credits, points, profile_picture, vocher_quantity, role')
      .eq('email_address', email)
      .eq('role', 'user')
      .single();

    if (!user) {
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert([
          {
            full_name: `${given_name} ${family_name}`,
            email_address: email,
            profile_picture: picture,
            role: 'user',
            status: 'inactive',
            auth_source: 'google',
            contact_number: null,
            credits: 0,
            points: 0,
            vocher_quantity: 0
          }
        ])
        .select('id, full_name, email_address, contact_number, status, credits, points, profile_picture, vocher_quantity, role');

      if (createError) {
        return res.status(500).json({ error: 'Error creating user account' });
      }
      user = newUser[0];
    }

    const token = jwt.sign(
      { 
        id: user.id,
        role: 'user',
        email: user.email_address
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '30d' }
    );

    res.json({
      user,
      token,
      role: 'user'
    });

  } catch (error) {
    console.error('Google OAuth login error:', error);
    res.status(500).json({ 
      error: 'Error during Google authentication',
      details: error.response?.data || error.message 
    });
  }
};

exports.requestPasswordReset = async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const { data: user, error: findError } = await supabase
      .from('users')
      .select('id, full_name, email_address, auth_source')
      .eq('email_address', email)
      .single();

    if (!user) {
      return res.status(404).json({ error: 'No account found with this email' });
    }

    if (user.auth_source === 'google') {
      return res.status(403).json({ 
        error: 'This account uses Google Sign-In. Please use Google Sign-In to access your account.' 
      });
    }

    const resetCode = generateResetCode();
    const resetCodeExpiry = new Date(Date.now() + 10 * 60 * 1000); 

    const { error: updateError } = await supabase
      .from('users')
      .update({
        reset_code: resetCode,
        reset_code_expiry: resetCodeExpiry
      })
      .eq('id', user.id);

    if (updateError) {
      return res.status(500).json({ error: 'Error saving reset code' });
    }

    const emailResult = await sendPasswordResetEmail(user.full_name, email, resetCode);
    if (emailResult.error) {
      return res.status(500).json({ error: emailResult.error });
    }

    res.json({ message: 'Password reset code sent to your email' });
  } catch (error) {
    console.error('Password reset request error:', error);
    res.status(500).json({ error: 'Error processing password reset request' });
  }
};

exports.verifyResetCode = async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ error: 'Email and code are required' });
  }

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, reset_code, reset_code_expiry')
      .eq('email_address', email)
      .single();

    if (!user) {
      return res.status(404).json({ error: 'No account found with this email' });
    }

    if (!user.reset_code || !user.reset_code_expiry) {
      return res.status(400).json({ error: 'No reset code found. Please request a new one.' });
    }

    if (user.reset_code !== code) {
      return res.status(400).json({ error: 'Invalid reset code' });
    }

    res.json({ message: 'Reset code verified successfully' });
  } catch (error) {
    console.error('Reset code verification error:', error);
    res.status(500).json({ error: 'Error verifying reset code' });
  }
};

exports.resetPassword = async (req, res) => {
  const { email, code, new_password } = req.body;
  if (!email || !code || !new_password) {
    return res.status(400).json({ error: 'Email, code, and new password are required' });
  }

  try {
    const { data: user, error: findError } = await supabase
      .from('users')
      .select('id, reset_code, reset_code_expiry')
      .eq('email_address', email)
      .single();

    if (!user) {
      return res.status(404).json({ error: 'No account found with this email' });
    }

    if (!user.reset_code || !user.reset_code_expiry) {
      return res.status(400).json({ error: 'No reset code found. Please request a new one.' });
    }

    if (user.reset_code !== code) {
      return res.status(400).json({ error: 'Invalid reset code' });
    }

    const { error: updateError } = await supabase
      .from('users')
      .update({
        password: new_password,
        reset_code: null,
        reset_code_expiry: null
      })
      .eq('id', user.id);

    if (updateError) {
      return res.status(500).json({ error: 'Error updating password' });
    }

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ error: 'Error resetting password' });
  }
};

exports.declineUser = async (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ error: 'User id is required' });
  }

  const { data: user, error: findError } = await supabase
    .from('users')
    .select('id')
    .eq('id', id)
    .eq('role', 'user')
    .single();

  if (findError) {
    return res.status(500).json({ error: findError.message });
  }

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const { error: deleteError } = await supabase
    .from('users')
    .delete()
    .eq('id', id);

  if (deleteError) {
    return res.status(500).json({ error: deleteError.message });
  }

  res.json({ message: 'User declined and removed successfully' });
};

// Get users based on requester role
exports.getUsersByRole = async (req, res) => {
  try {
    const userRole = req.user.role; // From JWT token
    const userId = req.user.id; // From JWT token

    if (userRole === 'admin') {
      // Admin gets all users with role 'user' only
      const { data, error } = await supabase
        .from('users')
        .select('id, first_name, last_name, email_address, country_code, number')
        .eq('role', 'user')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get user finances for all users
      const userIds = data.map(user => user.id);
      const { data: financesData, error: financesError } = await supabase
        .from('user_finances')
        .select('user_id, monthly_income')
        .in('user_id', userIds);

      if (financesError) throw financesError;

      // Create a map of user_id to monthly_income
      const financesMap = {};
      financesData.forEach(finance => {
        financesMap[finance.user_id] = finance.monthly_income || 0;
      });

      // Transform the data to include actual income values
      const users = data.map(user => ({
        id: user.id,
        full_name: `${user.first_name} ${user.last_name}`,
        email_address: user.email_address,
        contact_number: user.country_code + " " + user.number,
        income: financesMap[user.id] || 0,
        expense: 0,
        points: 0,
        vocher: 0
      }));

      res.json({ users });
    } else if (userRole === 'advisor') {

      const { data: assignedUsers, error: assignedError } = await supabase
        .from('assigned_users')
        .select(`
          user_id,
          users!assigned_users_user_id_fkey (
            id,
            first_name,
            last_name,
            email_address,
            country_code,
            number
          )
        `)
        .eq('mentor_id', userId);

      if (assignedError) throw assignedError;

      // Get user finances for assigned users
      const userIds = assignedUsers.map(assignment => assignment.users.id);
      const { data: financesData, error: financesError } = await supabase
        .from('user_finances')
        .select('user_id, monthly_income')
        .in('user_id', userIds);

      if (financesError) throw financesError;

      // Create a map of user_id to monthly_income
      const financesMap = {};
      financesData.forEach(finance => {
        financesMap[finance.user_id] = finance.monthly_income || 0;
      });

      // Transform the data to match the expected format
      const users = assignedUsers.map(assignment => ({
        id: assignment.users.id,
        full_name: `${assignment.users.first_name} ${assignment.users.last_name}`,
        email_address: assignment.users.email_address,
        contact_number: assignment.users.country_code + " " + assignment.users.number,
        income: financesMap[assignment.users.id] || 0,
        expense: 0,
        points: 0,
        vocher: 0
      }));

      res.json({ users });
    } else {
      return res.status(403).json({ error: 'Access denied. Admin or Advisor role required.' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get current user profile
exports.getCurrentUserProfile = async (req, res) => {
  try {
    const userId = req.user.id; // From JWT token

    const { data, error } = await supabase
      .from('users')
      .select('referral, full_name, contact_number, password, profile_picture, role, id')
      .eq('id', userId)
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ profile: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get current advisor and all advisors for a user
exports.getUserAdvisors = async (req, res) => {
  const { userId } = req.params;
  if (!userId) {
    return res.status(400).json({ error: 'User id is required' });
  }
  try {
    // Get current advisor assignment
    const { data: assignment, error: assignmentError } = await supabase
      .from('assigned_users')
      .select('mentor_id, users!assigned_users_mentor_id_fkey(full_name)')
      .eq('user_id', userId)
      .single();

    let currentAdvisor = null;
    if (assignment && assignment.mentor_id) {
      currentAdvisor = {
        id: assignment.mentor_id,
        full_name: assignment.users?.full_name || null
      };
    }

    // Get all advisors
    const { data: advisors, error: advisorsError } = await supabase
      .from('users')
      .select('id, full_name')
      .eq('role', 'advisor')
      .eq('status', 'active');

    if (advisorsError) throw advisorsError;

    res.json({ currentAdvisor, advisors });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Change advisor assignment for a user (admin only)
exports.changeUserAdvisor = async (req, res) => {
  const { userId, advisorId } = req.params;
  // Only admin can call this
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only admin can change advisor assignment.' });
  }
  if (!userId || !advisorId) {
    return res.status(400).json({ error: 'User id and advisor id are required' });
  }
  try {
    // Get current assignment
    const { data: currentAssignment, error: assignmentError } = await supabase
      .from('assigned_users')
      .select('mentor_id')
      .eq('user_id', userId)
      .single();

    const oldAdvisorId = currentAssignment?.mentor_id;

    // Remove current assignment
    await supabase.from('assigned_users').delete().eq('user_id', userId);

    // Insert new assignment
    const { error: insertError } = await supabase
      .from('assigned_users')
      .insert([{ mentor_id: advisorId, user_id: userId }]);
    if (insertError) throw insertError;

    // Update total_assigned for old advisor (decrement)
    if (oldAdvisorId) {
      const { data: oldAdvisor, error: oldFetchError } = await supabase
        .from('users')
        .select('total_assigned')
        .eq('id', oldAdvisorId)
        .single();
      if (!oldFetchError && oldAdvisor) {
        const newTotal = Math.max((oldAdvisor.total_assigned || 1) - 1, 0);
        await supabase.from('users').update({ total_assigned: newTotal }).eq('id', oldAdvisorId);
      }
    }
    // Update total_assigned for new advisor (increment)
    const { data: newAdvisor, error: newFetchError } = await supabase
      .from('users')
      .select('total_assigned')
      .eq('id', advisorId)
      .single();
    if (!newFetchError && newAdvisor) {
      const newTotal = (newAdvisor.total_assigned || 0) + 1;
      await supabase.from('users').update({ total_assigned: newTotal }).eq('id', advisorId);
    }
    res.json({ message: 'Advisor assignment updated successfully.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}; 

// Get combined user profile (users + user_finances)
exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    // Get user info
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('first_name, last_name, email_address, country_code, number, referral')
      .eq('id', userId)
      .single();

    console.log(user);
    if (userError) return res.status(500).json({ error: userError.message });
    if (!user) return res.status(404).json({ error: 'User not found' });
    // Get monthly_income
    const { data: finances, error: finError } = await supabase
      .from('user_finances')
      .select('monthly_income')
      .eq('user_id', userId)
      .maybeSingle();
    
    // Don't return error if no finances record exists, just use null
    if (finError && finError.code !== 'PGRST116') {
      return res.status(500).json({ error: finError.message });
    }
    
    res.json({
      first_name: user.first_name,
      last_name: user.last_name,
      country_code: user.country_code,
      referral: user.referral,
      number: user.number,
      email_address: user.email_address,
      monthly_income: finances ? finances.monthly_income : null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update combined user profile (users + user_finances)
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { first_name, last_name, email_address, country_code, number, monthly_income } = req.body;
    // Update users table
    const updateFields = {};
    if (first_name !== undefined) updateFields.first_name = first_name;
    if (last_name !== undefined) updateFields.last_name = last_name;
    if (email_address !== undefined) updateFields.email_address = email_address;
    if (country_code !== undefined) updateFields.country_code = country_code;
    if (number !== undefined) updateFields.number = number;
    let userUpdate, userError;
    if (Object.keys(updateFields).length > 0) {
      ({ data: userUpdate, error: userError } = await supabase
        .from('users')
        .update(updateFields)
        .eq('id', userId)
        .select('first_name, last_name, email_address, country_code, number')
        .single());
      if (userError) return res.status(500).json({ error: userError.message });
    } else {
      // Get current user if not updating
      ({ data: userUpdate, error: userError } = await supabase
        .from('users')
        .select('first_name, last_name, email_address, country_code, number')
        .eq('id', userId)
        .single());
      if (userError) return res.status(500).json({ error: userError.message });
    }
    // Update user_finances table
    let financesUpdate, finError;
    if (monthly_income !== undefined) {
      // First check if user_finances record exists
      const { data: existingFinances } = await supabase
        .from('user_finances')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (existingFinances) {
        // Update existing record
        ({ data: financesUpdate, error: finError } = await supabase
          .from('user_finances')
          .update({ monthly_income })
          .eq('user_id', userId)
          .select('monthly_income')
          .single());
      } else {
        // Create new record
        ({ data: financesUpdate, error: finError } = await supabase
          .from('user_finances')
          .insert({ user_id: userId, monthly_income })
          .select('monthly_income')
          .single());
      }
      
      if (finError) return res.status(500).json({ error: finError.message });
    } else {
      // Just get the existing record
      ({ data: financesUpdate, error: finError } = await supabase
        .from('user_finances')
        .select('monthly_income')
        .eq('user_id', userId)
        .maybeSingle());
      
      // Don't return error if no finances record exists
      if (finError && finError.code !== 'PGRST116') {
        return res.status(500).json({ error: finError.message });
      }
    }
    res.json({
      first_name: userUpdate.first_name,
      last_name: userUpdate.last_name,
      country_code: userUpdate.country_code,
      number: userUpdate.number,
      email_address: userUpdate.email_address,
      monthly_income: financesUpdate ? financesUpdate.monthly_income : null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}; 

// Send a 4-digit code to the user's email address
exports.sendVerificationCode = async (req, res) => {
  try {
    const userId = req.user.id;
    // Get user's email and name
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('first_name, last_name, email_address, country_code, number')
      .eq('id', userId)
      .single();
    if (userError) return res.status(500).json({ error: userError.message });
    if (!user) return res.status(404).json({ error: 'User not found' });
    // Generate 4-digit code
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    // Save code to user (email_code)
    const { error: updateError } = await supabase
      .from('users')
      .update({ email_code: code })
      .eq('id', userId);
    if (updateError) return res.status(500).json({ error: updateError.message });
    // Send email
    const { sendAdvisorVerificationEmail } = require('./emailService');
    const emailResult = await sendAdvisorVerificationEmail(getFullName(user), user.email_address, code);
    if (emailResult.error) return res.status(500).json({ error: emailResult.error });
    res.json({ message: 'Verification code sent to email.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}; 

// Delete the current user's account and log leaving reason
exports.deleteOwnAccount = async (req, res) => {
  try {
    const userId = req.user.id;
    const { leaving_reason } = req.body;
    if (!leaving_reason) return res.status(400).json({ error: 'leaving_reason is required' });
    // Get user info
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('first_name, last_name, email_address, country_code, number')
      .eq('id', userId)
      .single();
    if (userError) return res.status(500).json({ error: userError.message });
    if (!user) return res.status(404).json({ error: 'User not found' });
    // Insert leaving reason
    const { error: reasonError } = await supabase
      .from('leaving_reason')
      .insert({
        full_name: getFullName(user),
        email: user.email_address,
        leaving_reason
      });
    if (reasonError) return res.status(500).json({ error: reasonError.message });
    // Delete user
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', userId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: 'User account deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}; 

// Get current user's points
exports.getPoints = async (req, res) => {
  try {
    const userId = req.user.id;
    const { data, error } = await supabase
      .from('users')
      .select('points')
      .eq('id', userId)
      .single();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'No points data found for user' });
    res.json({ points: data.points });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}; 

// Get user notifications (rewards where is_approved=true or is_redeemed=true)
exports.getUserNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const { data, error } = await supabase
      .from('rewards_assignee')
      .select(`
        *,
        rewards (
          id,
          picture,
          name,
          price
        )
      `)
      .eq('assignee_id', userId)
      .or('is_approved.eq.true')
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ notifications: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Redeem user reward (check approval, provide code, update is_redeemed, prevent duplicates)
exports.redeemUserReward = async (req, res) => {
  try {
    const userId = req.user.id;
    const { reward_id } = req.body;
    
    if (!reward_id) {
      return res.status(400).json({ error: 'reward_id is required' });
    }

    // Get the reward assignment
    const { data: rewardAssignment, error: assignmentError } = await supabase
      .from('rewards_assignee')
      .select(`
        *,
        rewards (
          id,
          picture,
          name,
          price,
          codes
        )
      `)
      .eq('id', reward_id)
      .eq('assignee_id', userId)
      .single();

    if (assignmentError) {
      return res.status(500).json({ error: assignmentError.message });
    }

    if (!rewardAssignment) {
      return res.status(404).json({ error: 'Reward assignment not found' });
    }

    // // Check if already redeemed
    // if (rewardAssignment.is_redeemed) {
    //   return res.status(400).json({ error: 'Reward already redeemed' });
    // }

    // Check if approved by advisor
    if (rewardAssignment.is_approved) {
      // Get the redeemed codes from reward_code field
      let redeemedCodes = rewardAssignment.reward_code;

      if (redeemedCodes.length === 0) {
        return res.status(400).json({ error: 'No redeemed codes available for this reward' });
      }

      // Update reward assignment as redeemed
      const { error: updateAssignmentError } = await supabase
        .from('rewards_assignee')
        .update({ is_redeemed: true })
        .eq('id', reward_id);

      if (updateAssignmentError) {
        return res.status(500).json({ error: updateAssignmentError.message });
      }

      return res.json({ 
        message: 'Reward has already been approved and redeemed successfully',
        codes: redeemedCodes,
        reward: rewardAssignment
      });
    }

    // Reward is not approved, check if sent to advisor
    if (rewardAssignment.sent_to_advisor) {
      return res.json({ 
        message: 'Waiting for advisor to approve the reward',
        status: 'pending_approval'
      });
    }

    // Reward not sent to advisor yet, send it now
    const { error: updateSentError } = await supabase
      .from('rewards_assignee')
      .update({ sent_to_advisor: true })
      .eq('id', reward_id);

    if (updateSentError) {
      return res.status(500).json({ error: updateSentError.message });
    }

    return res.json({ 
      message: 'Reward sent to advisor for approval',
      status: 'sent_to_advisor'
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}; 

// Get all advisor rewards for the current user
exports.getUserAdvisorRewards = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // First get all reward assignments
    const { data: assignments, error: assignmentError } = await supabase
      .from('rewards_assignee')
      .select('*')
      .eq('assignee_id', userId)
      .order('created_at', { ascending: false });

    if (assignmentError) {
      return res.status(500).json({ error: assignmentError.message });
    }

    // Get unique reward IDs
    const rewardIds = [...new Set(assignments.map(assignment => assignment.reward_id))];
    
    // Fetch reward details separately
    const { data: rewards, error: rewardsError } = await supabase
      .from('rewards')
      .select('id, picture, name')
      .in('id', rewardIds);

    if (rewardsError) {
      return res.status(500).json({ error: rewardsError.message });
    }

    // Create a map of reward_id to reward details
    const rewardsMap = {};
    rewards.forEach(reward => {
      rewardsMap[reward.id] = reward;
    });

    // Combine assignments with reward details
    const rewardsWithDetails = assignments.map(assignment => ({
      ...assignment,
      reward: rewardsMap[assignment.reward_id] || null
    }));

    res.json({ rewards: rewardsWithDetails });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};