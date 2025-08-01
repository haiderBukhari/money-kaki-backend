const supabase = require('../supabaseClient');
const { sendAdvisorVerificationEmail, sendPasswordResetEmail } = require('./emailService');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');

// Initialize Google OAuth client with credentials
const client = new OAuth2Client(
  process.env.OAUTH_CLIENT_ID,
  process.env.OAUTH_CLIENT_SECRET,
  process.env.REDIRECT_URI
);

// Helper to generate a random email code
function generateEmailCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// Helper to generate a random 6-digit code
function generateResetCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Helper to generate a random 6-digit referral code
function generateReferralCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
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
  const referral = generateReferralCode();

  // Insert new advisor
  const { data, error } = await supabase
    .from('users')
    .insert([
      {
        full_name,
        email_address,
        contact_number,
        email_code,
        referral,
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

  // Convert empty strings to null for numeric fields
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
    .select('id, full_name, email_address, contact_number, status, credits, points, profile_picture, vocher_quantity, created_at')
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

  // First check if user exists and their auth source
  const { data: advisor, error: findError } = await supabase
    .from('users')
    .select('id, full_name, email_address, contact_number, status, credits, points, profile_picture, vocher_quantity, role, auth_source, password')
    .eq('email_address', email)
    .single();

  if (!advisor) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  if (advisor.status === 'inactive') {
    return res.status(403).json({ error: 'Your account is inactive. Please contact support to reactivate your account.' });
  }

  if (!(advisor.role === 'advisor' || advisor.role === 'admin')) {
    return res.status(403).json({ error: 'User is not an advisor' });
  }

  if (advisor.auth_source === 'google') {
    return res.status(403).json({
      error: 'This account was created using Google Sign-In. Please use Google Sign-In to access your account.'
    });
  }

  // Then verify password
  if (advisor.password !== password) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  if (findError) {
    return res.status(500).json({ error: findError.message });
  }

  const token = jwt.sign(
    {
      id: advisor.id,
      role: advisor.role,
      email: advisor.email_address
    },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '30d' }
  );

  res.json({ advisor, token, role: advisor.role });
};

exports.getRole = async (req, res) => {
  try {
    // The user info is already attached to req.user by the middleware
    const { id, role } = req.user;

    // Get additional user details from database
    const { data: user, error } = await supabase
      .from('users')
      .select('id, first_name, last_name, country_code, referral, number, email_address, role, status, profile_picture')
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
      first_name: user.first_name,
      last_name: user.last_name,
      country_code: user.country_code,
      referral: user.referral,
      number: user.number,
      email_address: user.email_address,
      status: user.status,
      profile_picture: user.profile_picture,
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

    let { data: advisor, error: findError } = await supabase
      .from('users')
      .select('id, full_name, email_address, contact_number, status, credits, points, profile_picture, vocher_quantity, role')
      .eq('email_address', email)
      .eq('role', 'advisor')
      .single();

    if (!advisor) {
      const { data: newAdvisor, error: createError } = await supabase
        .from('users')
        .insert([
          {
            full_name: `${given_name} ${family_name}`,
            email_address: email,
            profile_picture: picture,
            role: 'advisor',
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
        return res.status(500).json({ error: 'Error creating advisor account' });
      }
      advisor = newAdvisor[0];
    }

    const token = jwt.sign(
      {
        id: advisor.id,
        role: 'advisor',
        email: advisor.email_address
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '30d' }
    );

    res.json({
      advisor,
      token,
      role: 'advisor'
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
    // Check if user exists and is not a Google user
    const { data: advisor, error: findError } = await supabase
      .from('users')
      .select('id, full_name, email_address, auth_source')
      .eq('email_address', email)
      .single();

    if (!advisor) {
      return res.status(404).json({ error: 'No account found with this email' });
    }

    if (advisor.auth_source === 'google') {
      return res.status(403).json({
        error: 'This account uses Google Sign-In. Please use Google Sign-In to access your account.'
      });
    }

    // Generate reset code
    const resetCode = generateResetCode();
    const resetCodeExpiry = new Date(Date.now() + 10 * 60 * 1000);

    // Save reset code and expiry to database
    const { error: updateError } = await supabase
      .from('users')
      .update({
        reset_code: resetCode,
        reset_code_expiry: resetCodeExpiry
      })
      .eq('id', advisor.id);

    if (updateError) {
      return res.status(500).json({ error: 'Error saving reset code' });
    }

    // Send reset email
    const emailResult = await sendPasswordResetEmail(advisor.full_name, email, resetCode);
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
    const { data: advisor, error } = await supabase
      .from('users')
      .select('id, reset_code, reset_code_expiry')
      .eq('email_address', email)
      .single();

    if (!advisor) {
      return res.status(404).json({ error: 'No account found with this email' });
    }

    // Check if code exists and hasn't expired
    if (!advisor.reset_code || !advisor.reset_code_expiry) {
      return res.status(400).json({ error: 'No reset code found. Please request a new one.' });
    }

    if (advisor.reset_code !== code) {
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
    const { data: advisor, error: findError } = await supabase
      .from('users')
      .select('id, reset_code, reset_code_expiry')
      .eq('email_address', email)
      .single();

    if (!advisor) {
      return res.status(404).json({ error: 'No account found with this email' });
    }

    // Verify code again before allowing password reset
    if (!advisor.reset_code || !advisor.reset_code_expiry) {
      return res.status(400).json({ error: 'No reset code found. Please request a new one.' });
    }

    if (advisor.reset_code !== code) {
      return res.status(400).json({ error: 'Invalid reset code' });
    }

    // Update password and clear reset code
    const { error: updateError } = await supabase
      .from('users')
      .update({
        password: new_password,
        reset_code: null,
        reset_code_expiry: null
      })
      .eq('id', advisor.id);

    if (updateError) {
      return res.status(500).json({ error: 'Error updating password' });
    }

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ error: 'Error resetting password' });
  }
};

exports.declineAdvisor = async (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ error: 'Advisor id is required' });
  }

  // First check if advisor exists
  const { data: advisor, error: findError } = await supabase
    .from('users')
    .select('id')
    .eq('id', id)
    .eq('role', 'advisor')
    .single();

  if (findError) {
    return res.status(500).json({ error: findError.message });
  }

  if (!advisor) {
    return res.status(404).json({ error: 'Advisor not found' });
  }

  // Delete the advisor
  const { error: deleteError } = await supabase
    .from('users')
    .delete()
    .eq('id', id);

  if (deleteError) {
    return res.status(500).json({ error: deleteError.message });
  }

  res.json({ message: 'Advisor declined and removed successfully' });
};

exports.getAdvisorCredits = async (req, res) => {
  try {
    const userId = req.user.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { data: advisor, error } = await supabase
      .from('users')
      .select('id, full_name, email_address, credits, points, vocher_quantity')
      .eq('id', userId)
      // .eq('role', 'advisor')
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    if (!advisor) {
      return res.status(404).json({ error: 'Advisor not found' });
    }

    res.json({
      id: advisor.id,
      full_name: advisor.full_name,
      email_address: advisor.email_address,
      credits: advisor.credits || 0,
      points: advisor.points || 0,
      vocher_quantity: advisor.vocher_quantity || 0
    });
  } catch (error) {
    console.error('Get advisor credits error:', error);
    res.status(500).json({ error: 'Error fetching advisor credits' });
  }
};

// Get all rewards assigned to the advisor (assignee_id from token)
exports.getAdvisorRewards = async (req, res) => {
  try {
    const assigneeId = req.user.id; // This is the advisor's ID

    const { data, error } = await supabase
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
      .eq('assignee_id', assigneeId)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ rewards: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Redeem advisor reward (complex logic with points deduction and code assignment)
exports.redeemAdvisorReward = async (req, res) => {
  try {
    const assigneeId = req.user.id; // This is the advisor's ID
    const { reward_id } = req.body;

    if (!reward_id) {
      return res.status(400).json({ error: 'reward_id is required' });
    }

    // Step 1: Get the reward assignment by created_by and id
    const { data: assignment, error: assignmentError } = await supabase
      .from('rewards_assignee')
      .select('*')
      .eq('id', reward_id)
      .eq('created_by', assigneeId)
      .single();

    if(assignment.is_approved) {
      return res.status(400).json({ error: 'Reward has already been approved' });
    }

    if (assignmentError) {
      return res.status(500).json({ error: assignmentError.message });
    }

    if (!assignment) {
      return res.status(404).json({ error: 'Reward assignment not found' });
    }

    // Step 2: Get the reward details to check price and codes
    const { data: reward, error: rewardError } = await supabase
      .from('rewards')
      .select('*')
      .eq('id', assignment.reward_id)
      .single();

    if (rewardError) {
      return res.status(500).json({ error: rewardError.message });
    }

    if (!reward) {
      return res.status(404).json({ error: 'Reward not found' });
    }

    // Step 3: Parse codes and check availability
    let codes = [];
    
    // Check if reward.codes exists and handle both string and object formats
    if (reward.codes) {
      if (typeof reward.codes === 'string' && reward.codes.trim() !== '') {
        try {
          codes = JSON.parse(reward.codes);
          // Ensure codes is an array
          if (!Array.isArray(codes)) {
            codes = [];
          }
        } catch (e) {
          console.error('Error parsing reward codes:', e);
          console.error('Raw codes value:', reward.codes);
          return res.status(500).json({ error: 'Invalid codes format in database' });
        }
      } else if (Array.isArray(reward.codes)) {
        // Codes is already an array
        codes = reward.codes;
      } else {
        console.error('Unexpected codes format:', typeof reward.codes, reward.codes);
        return res.status(500).json({ error: 'Invalid codes format in database' });
      }
    }

    const availableCodes = codes.filter(code => code && !code.is_redeemed);
    if (availableCodes.length < assignment.quantity) {
      return res.status(400).json({ 
        error: `Not enough codes available. Need ${assignment.quantity}, but only ${availableCodes.length} available.` 
      });
    }

    // Step 4: Calculate total points needed
    const rewardPrice = parseFloat(reward.price) || 0;
    const totalPointsNeeded = rewardPrice * assignment.quantity;

    // Step 5: Check if advisor has enough credits
    const { data: advisor, error: advisorError } = await supabase
      .from('users')
      .select('credits')
      .eq('id', assigneeId)
      .single();

    if (advisorError) {
      return res.status(500).json({ error: advisorError.message });
    }

    if (!advisor) {
      return res.status(404).json({ error: 'Advisor not found' });
    }

    if (advisor.credits < totalPointsNeeded) {
      return res.status(400).json({ 
        error: `Insufficient credits. Need ${totalPointsNeeded} credits, but only have ${advisor.credits} credits.` 
      });
    }

    // Step 6: Select codes to redeem (take first N available codes)
    const codesToRedeem = availableCodes.slice(0, assignment.quantity);
    const redeemedCodes = [];

    // Step 7: Mark selected codes as redeemed
    codesToRedeem.forEach(codeToRedeem => {
      const codeIndex = codes.findIndex(code => code.code === codeToRedeem.code);
      if (codeIndex !== -1) {
        codes[codeIndex].is_redeemed = true;
        redeemedCodes.push(codeToRedeem.code);
      }
    });

    // Step 8: Update rewards table with new codes array
    const { error: updateRewardError } = await supabase
      .from('rewards')
      .update({ codes: codes }) // Store as JSONB object, not string
      .eq('id', reward.id);

    if (updateRewardError) {
      return res.status(500).json({ error: updateRewardError.message });
    }

    // Step 9: Deduct credits from advisor
    const newCredits = advisor.credits - totalPointsNeeded;
    const { error: updateCreditsError } = await supabase
      .from('users')
      .update({ credits: newCredits })
      .eq('id', assigneeId);

    if (updateCreditsError) {
      return res.status(500).json({ error: updateCreditsError.message });
    }

    // Step 10: Update reward assignment
    const { error: updateAssignmentError } = await supabase
      .from('rewards_assignee')
      .update({ 
        is_approved: true,
        reward_code: redeemedCodes // Store as JSONB array, not string
      })
      .eq('id', reward_id);

    if (updateAssignmentError) {
      return res.status(500).json({ error: updateAssignmentError.message });
    }

    res.json({ 
      message: 'Reward redeemed successfully',
      redeemed_codes: redeemedCodes,
      credits_deducted: totalPointsNeeded,
      remaining_credits: newCredits,
      assignment: {
        ...assignment,
        is_approved: true,
        reward_code: redeemedCodes
      }
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get advisor notifications (rewards where sent_to_advisor=true and is_approved=false OR is_approved=true)
exports.getAdvisorNotifications = async (req, res) => {
  try {
    const assigneeId = req.user.id; // This is the advisor's ID

    // First get all reward assignments
    const { data: assignments, error: assignmentError } = await supabase
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
      .eq('created_by', assigneeId)
      .eq('sent_to_advisor', true)
      .order('created_at', { ascending: false });

    console.log(assigneeId);

    if (assignmentError) {
      return res.status(500).json({ error: assignmentError.message });
    }

    // Get unique user IDs from assignments
    const userIds = [...new Set(assignments.map(assignment => assignment.assignee_id))];

    // Fetch user details separately
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, first_name, last_name, email_address, country_code, number')
      .in('id', userIds);

    if (usersError) {
      return res.status(500).json({ error: usersError.message });
    }

    // Create a map of user_id to user details
    const usersMap = {};
    users.forEach(user => {
      usersMap[user.id] = user;
    });

    // Transform data to include user details and status
    const notifications = assignments.map(item => ({
      ...item,
      user: usersMap[item.assignee_id] ? {
        id: usersMap[item.assignee_id].id,
        full_name: `${usersMap[item.assignee_id].first_name} ${usersMap[item.assignee_id].last_name}`,
        email_address: usersMap[item.assignee_id].email_address,
        contact_number: `${usersMap[item.assignee_id].country_code} ${usersMap[item.assignee_id].number}`
      } : null,
      status: item.is_approved ? 'approved' : (item.sent_to_advisor ? 'pending_approval' : 'new')
    }));

    res.json({ notifications });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};