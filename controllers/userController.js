const supabase = require('../supabaseClient');
const { sendAdvisorVerificationEmail, sendPasswordResetEmail } = require('./emailService');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const AWS = require('aws-sdk');
const multer = require('multer');
const multerS3 = require('multer-s3');

const client = new OAuth2Client(
  process.env.OAUTH_CLIENT_ID,
  process.env.OAUTH_CLIENT_SECRET,
  process.env.REDIRECT_URI
);

// Configure AWS with environment variables
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

const s3 = new AWS.S3();

// Configure multer for S3 upload
const upload = multer({
  storage: multerS3({
    s3,
    bucket: process.env.AWS_S3_BUCKET,
    key: (req, file, cb) => {
      const uniqueName = `profile-images/${Date.now()}-${file.originalname}`;
      cb(null, uniqueName);
    }
  }),
  fileFilter: (req, file, cb) => {
    // Only accept image files
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type – only images allowed"), false);
    }
  },
  limits: { 
    fileSize: 5 * 1024 * 1024 // limit: 5MB
  }
});

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
  const { first_name, last_name, email_address, country_code, number, referal_code, birthday_date, profile_picture } = req.body;
  if (!first_name || !last_name || !email_address) {
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
        birthday_date,
        profile_picture,
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

  // Create user_finances record for the new user
  const { error: financeError } = await supabase
    .from('user_finances')
    .insert([
      {
        user_id: data[0].id,
        monthly_income: 0,
        wallet: 0
      }
    ]);

  if (financeError) {
    console.log(financeError)
    // If finance record creation fails, clean up the user
    await supabase.from('users').delete().eq('id', data[0].id);
    if (mentorId) {
      await supabase.from('assigned_users').delete().eq('user_id', data[0].id);
    }
    return res.status(500).json({ error: 'Failed to create user finances record' });
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
    .select('id, first_name, last_name, email_address, country_code, number, status, credits, points, profile_picture, vocher_quantity, role, auth_source, password, birthday_date')
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

  try {
    // Separate user fields from finance fields
    const userFields = {};
    const financeFields = {};
    
    Object.keys(updateFields).forEach(key => {
      if (['monthly_income', 'monthly_expense'].includes(key)) {
        financeFields[key] = updateFields[key];
      } else {
        userFields[key] = updateFields[key];
      }
    });

    // Handle contact_number field if it exists (for backward compatibility)
    if (userFields.contact_number) {
      const contactParts = userFields.contact_number.trim().split(' ');
      userFields.country_code = contactParts[0] || '+65';
      userFields.number = contactParts.slice(1).join(' ') || userFields.contact_number;
      delete userFields.contact_number;
    }

    // Process numeric fields for user table
    const numericFields = ['credits', 'points', 'vocher_quantity'];
    numericFields.forEach(field => {
      if (userFields[field] === '') {
        userFields[field] = null;
      }
    });

    // Update user table if there are user fields
    if (Object.keys(userFields).length > 0) {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .update(userFields)
        .eq('id', id)
        .select();

      if (userError) {
        return res.status(500).json({ error: userError.message });
      }
    }

    // Update user_finances table if there are finance fields
    if (Object.keys(financeFields).length > 0) {
      // Check if user_finances record exists
      const { data: existingFinance, error: checkError } = await supabase
        .from('user_finances')
        .select('id')
        .eq('user_id', id)
        .single();

      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "not found"
        return res.status(500).json({ error: checkError.message });
      }

      if (existingFinance) {
        // Update existing record
        const { error: financeError } = await supabase
          .from('user_finances')
          .update(financeFields)
          .eq('user_id', id);

        if (financeError) {
          return res.status(500).json({ error: financeError.message });
        }
      } else {
        // Create new record
        const { error: financeError } = await supabase
          .from('user_finances')
          .insert({
            user_id: id,
            ...financeFields
          });

        if (financeError) {
          return res.status(500).json({ error: financeError.message });
        }
      }
    }

    // Get updated user data with the same format as getUserById
    const { data: updatedUser, error: getError } = await supabase
      .from('users')
      .select('id, first_name, last_name, email_address, country_code, number, status, credits, points, profile_picture, vocher_quantity, role')
      .eq('id', id)
      .single();

    if (getError) {
      return res.status(500).json({ error: getError.message });
    }

    // Get user finances
    const { data: finances, error: financesError } = await supabase
      .from('user_finances')
      .select('monthly_income, monthly_expense')
      .eq('user_id', id)
      .single();

    // Get voucher count from rewards_assignee - include both approved and redeemed
    const { data: voucherData, error: voucherError } = await supabase
      .from('rewards_assignee')
      .select('quantity, is_approved, is_redeemed')
      .eq('assignee_id', id);

    let totalVouchers = 0;
    let approvedVouchers = 0;
    let redeemedVouchers = 0;

    if (voucherData) {
      voucherData.forEach(item => {
        const quantity = item.quantity || 0;
        totalVouchers += quantity;
        if (item.is_approved) {
          approvedVouchers += quantity;
        }
        if (item.is_redeemed) {
          redeemedVouchers += quantity;
        }
      });
    }

    // Combine the data
    const userData = {
      ...updatedUser,
      full_name: `${updatedUser.first_name || ''} ${updatedUser.last_name || ''}`.trim(),
      contact_number: `${updatedUser.country_code || ''} ${updatedUser.number || ''}`.trim(),
      monthly_income: finances?.monthly_income || 0,
      monthly_expense: finances?.monthly_expense || 0,
      voucher_count: totalVouchers,
      voucher_details: {
        total: totalVouchers,
        approved: approvedVouchers,
        redeemed: redeemedVouchers
      }
    };

    res.json({ message: 'User updated successfully', user: userData });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getUserById = async (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ error: 'User id is required' });
  }

  try {
    // Get user basic info
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, first_name, last_name, email_address, country_code, number, status, credits, points, profile_picture, vocher_quantity, role')
      .eq('id', id)
      .eq('role', 'user')
      .single();

    if (userError) {
      return res.status(500).json({ error: userError.message });
    }
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user finances
    const { data: finances, error: financesError } = await supabase
      .from('user_finances')
      .select('monthly_income, monthly_expense')
      .eq('user_id', id)
      .single();

    // Get voucher count from rewards_assignee - include both approved and redeemed
    const { data: voucherData, error: voucherError } = await supabase
      .from('rewards_assignee')
      .select('quantity, is_approved, is_redeemed')
      .eq('assignee_id', id);

    let totalVouchers = 0;
    let approvedVouchers = 0;
    let redeemedVouchers = 0;

    if (voucherData) {
      voucherData.forEach(item => {
        const quantity = item.quantity || 0;
        totalVouchers += quantity;
        if (item.is_approved) {
          approvedVouchers += quantity;
        }
        if (item.is_redeemed) {
          redeemedVouchers += quantity;
        }
      });
    }

    // Combine the data
    const userData = {
      ...user,
      full_name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
      contact_number: `${user.country_code || ''} ${user.number || ''}`.trim(),
      monthly_income: finances?.monthly_income || 0,
      monthly_expense: finances?.monthly_expense || 0,
      voucher_count: totalVouchers
    };

    res.json({ user: userData });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
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
    .select('id, first_name, last_name, email_address, country_code, number, status, credits, points, profile_picture, vocher_quantity, role, auth_source, password, birthday_date')
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
        .select('id, first_name, last_name, email_address, country_code, number, points')
        .eq('role', 'user')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get user finances for all users
      const userIds = data.map(user => user.id);
      const { data: financesData, error: financesError } = await supabase
        .from('user_finances')
        .select('user_id, monthly_income, monthly_expense')
        .in('user_id', userIds);

      if (financesError) throw financesError;

      // Get voucher quantities from rewards_assignee for all users
      const { data: voucherData, error: voucherError } = await supabase
        .from('rewards_assignee')
        .select('assignee_id, quantity')
        .eq('is_approved', true)
        .in('assignee_id', userIds);

      if (voucherError) throw voucherError;

      // Create maps for finances and vouchers
      const financesMap = {};
      financesData.forEach(finance => {
        financesMap[finance.user_id] = {
          monthly_income: finance.monthly_income || 0,
          monthly_expense: finance.monthly_expense || 0
        };
      });

      const voucherMap = {};
      voucherData.forEach(voucher => {
        if (voucherMap[voucher.assignee_id]) {
          voucherMap[voucher.assignee_id] += (voucher.quantity || 0);
        } else {
          voucherMap[voucher.assignee_id] = (voucher.quantity || 0);
        }
      });

      // Get advisor assignments for all users
      const { data: assignedData, error: assignedError } = await supabase
        .from('assigned_users')
        .select(`
          user_id,
          mentor_id,
          users!assigned_users_mentor_id_fkey (
            first_name,
            last_name,
            full_name
          )
        `)
        .in('user_id', userIds);

      if (assignedError) throw assignedError;

      // Create map for advisor assignments
      const advisorMap = {};
      assignedData.forEach(assignment => {
        if (assignment.users) {
          advisorMap[assignment.user_id] = assignment.users.full_name? assignment.users.full_name : (assignment.users.first_name) ? `${assignment.users.first_name} ${assignment.users.last_name}` : 'Not Assigned';
        }
      });

      // Transform the data to include actual income, expense, voucher values, and advisor
      const users = data.map(user => ({
        id: user.id,
        full_name: `${user.first_name} ${user.last_name}`,
        email_address: user.email_address,
        contact_number: user.country_code + " " + user.number,
        income: financesMap[user.id]?.monthly_income || 0,
        expense: financesMap[user.id]?.monthly_expense || 0,
        points: user.points,
        vocher: voucherMap[user.id] || 0,
        advisor: advisorMap[user.id] || 'Not Assigned'
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
            number,
            points
          )
        `)
        .eq('mentor_id', userId);

      if (assignedError) throw assignedError;

      // Get user finances for assigned users
      const userIds = assignedUsers.map(assignment => assignment.users.id);
      const { data: financesData, error: financesError } = await supabase
        .from('user_finances')
        .select('user_id, monthly_income, monthly_expense')
        .in('user_id', userIds);

      if (financesError) throw financesError;

      // Get voucher quantities from rewards_assignee for assigned users
      const { data: voucherData, error: voucherError } = await supabase
        .from('rewards_assignee')
        .select('assignee_id, quantity')
        .eq('is_approved', true)
        .in('assignee_id', userIds);

      if (voucherError) throw voucherError;

      // Create maps for finances and vouchers
      const financesMap = {};
      financesData.forEach(finance => {
        financesMap[finance.user_id] = {
          monthly_income: finance.monthly_income || 0,
          monthly_expense: finance.monthly_expense || 0
        };
      });

      const voucherMap = {};
      voucherData.forEach(voucher => {
        if (voucherMap[voucher.assignee_id]) {
          voucherMap[voucher.assignee_id] += (voucher.quantity || 0);
        } else {
          voucherMap[voucher.assignee_id] = (voucher.quantity || 0);
        }
      });

      // Transform the data to match the expected format
      const users = assignedUsers.map(assignment => ({
        id: assignment.users.id,
        full_name: `${assignment.users.first_name} ${assignment.users.last_name}`,
        email_address: assignment.users.email_address,
        contact_number: assignment.users.country_code + " " + assignment.users.number,
        income: financesMap[assignment.users.id]?.monthly_income || 0,
        expense: financesMap[assignment.users.id]?.monthly_expense || 0,
        points: assignment.users?.points,
        vocher: voucherMap[assignment.users.id] || 0,
        advisor: 'You' // Since this is the advisor's view, they are the advisor for these users
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
      .select('id, full_name, email_address')
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
      .select('id, role, first_name, last_name, email_address, country_code, number, status, profile_picture, referral')
      .eq('id', userId)
      .single();

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
      profile_picture: user.profile_picture,
      status: user.status,
      role: user.role,
      id: user.id,
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
    const { first_name, last_name, email_address, country_code, number, monthly_income, birthday_date } = req.body;
    // Update users table
    const updateFields = {};
    if (first_name !== undefined) updateFields.first_name = first_name;
    if (last_name !== undefined) updateFields.last_name = last_name;
    if (email_address !== undefined) updateFields.email_address = email_address;
    if (country_code !== undefined) updateFields.country_code = country_code;
    if (number !== undefined) updateFields.number = number;
    if (birthday_date !== undefined) updateFields.birthday_date = birthday_date;
    let userUpdate, userError;
    if (Object.keys(updateFields).length > 0) {
      ({ data: userUpdate, error: userError } = await supabase
        .from('users')
        .update(updateFields)
        .eq('id', userId)
        .select('first_name, last_name, email_address, country_code, number, birthday_date')
        .single());
      if (userError) return res.status(500).json({ error: userError.message });
    } else {
      // Get current user if not updating
      ({ data: userUpdate, error: userError } = await supabase
        .from('users')
        .select('first_name, last_name, email_address, country_code, number, birthday_date')
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
      birthday_date: userUpdate.birthday_date,
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

exports.sendVerificationEmailByEmail = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if email exists in users table
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, first_name, last_name, email_address, full_name')
      .eq('email_address', email)
      .single();

    if (userError) {
      return res.status(404).json({ error: 'User with this email not found' });
    }


    const userName = (user.first_name && user.last_name) !== null  ? `${user.first_name} ${user.last_name}` : user.full_name;

    if (!user) {
      return res.status(404).json({ error: 'User with this email not found' });
    }

    // Generate 4-digit code
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    
    // Save code to user (email_code)
    const { error: updateError } = await supabase
      .from('users')
      .update({ email_code: code })
      .eq('id', user.id);
      
    if (updateError) {
      return res.status(500).json({ error: updateError.message });
    }

    // Send email
    const emailResult = await sendAdvisorVerificationEmail(userName, user.email_address, code);
    
    if (emailResult.error) {
      return res.status(500).json({ error: emailResult.error });
    }

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

    // 1) Delete rewards_assignee rows for this user
    const { error: raDeleteError } = await supabase
      .from('rewards_assignee')
      .delete()
      .eq('assignee_id', userId);
    if (raDeleteError) return res.status(500).json({ error: raDeleteError.message });

    // Also delete rewards_assignee created by this user (safety)
    const { error: raCreatedByDeleteError } = await supabase
      .from('rewards_assignee')
      .delete()
      .eq('created_by', userId);
    if (raCreatedByDeleteError) return res.status(500).json({ error: raCreatedByDeleteError.message });

    // 2) Delete transactions for this user
    const { error: txDeleteError } = await supabase
      .from('transactions')
      .delete()
      .eq('user_id', userId);
    if (txDeleteError) return res.status(500).json({ error: txDeleteError.message });

    // 3) Delete user_finances for this user
    const { error: ufDeleteError } = await supabase
      .from('user_finances')
      .delete()
      .eq('user_id', userId);
    if (ufDeleteError) return res.status(500).json({ error: ufDeleteError.message });

    // 4) Delete assigned_users mapping for this user
    const { error: auDeleteError } = await supabase
      .from('assigned_users')
      .delete()
      .eq('user_id', userId);
    if (auDeleteError) return res.status(500).json({ error: auDeleteError.message });

    // Also remove assignments where this user is a mentor/advisor (safety)
    const { error: auMentorDeleteError } = await supabase
      .from('assigned_users')
      .delete()
      .eq('mentor_id', userId);
    if (auMentorDeleteError) return res.status(500).json({ error: auMentorDeleteError.message });

    // 5) Delete savings (via user's goals), then goals for this user
    const { data: goals, error: goalsFetchError } = await supabase
      .from('goals')
      .select('id')
      .eq('user_id', userId);
    if (goalsFetchError) return res.status(500).json({ error: goalsFetchError.message });

    const goalIds = (goals || []).map(g => g.id);
    if (goalIds.length > 0) {
      const { error: savingsDeleteError } = await supabase
        .from('savings')
        .delete()
        .in('goal_id', goalIds);
      if (savingsDeleteError) return res.status(500).json({ error: savingsDeleteError.message });
    }

    const { error: goalsDeleteError } = await supabase
      .from('goals')
      .delete()
      .eq('user_id', userId);
    if (goalsDeleteError) return res.status(500).json({ error: goalsDeleteError.message });

    // 6) Delete challenges where this user is the target or creator (safety)
    const { error: chUserDeleteError } = await supabase
      .from('challenges')
      .delete()
      .eq('user_id', userId);
    if (chUserDeleteError) return res.status(500).json({ error: chUserDeleteError.message });

    const { error: chCreatorDeleteError } = await supabase
      .from('challenges')
      .delete()
      .eq('created_by', userId);
    if (chCreatorDeleteError) return res.status(500).json({ error: chCreatorDeleteError.message });

    // Finally, delete the user
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

    // Get user's birthday for birthday schedule type filtering
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('birthday_date')
      .eq('id', userId)
      .single();

    if (userError) {
      return res.status(500).json({ error: userError.message });
    }

    // Create a map of reward_id to reward details
    const rewardsMap = {};
    rewards.forEach(reward => {
      rewardsMap[reward.id] = reward;
    });

    // Filter assignments based on schedule type and date conditions
    const today = new Date();
    const todayMonth = today.getMonth() + 1; // getMonth() returns 0-11
    const todayDay = today.getDate();
    
    const filteredAssignments = assignments.filter(assignment => {
      if (assignment.schedule_type === 'birthday') {
        if (!user.birthday_date) return false;
        
        const birthday = new Date(user.birthday_date);
        const birthdayMonth = birthday.getMonth() + 1;
        const birthdayDay = birthday.getDate();
        
        // Check if birthday is today
        if (birthdayMonth === todayMonth && birthdayDay === todayDay) {
          return true;
        }
        
        // Check if birthday was within the last week (comparing only month and day)
        const oneWeekAgo = new Date(today);
        oneWeekAgo.setDate(today.getDate() - 7);
        
        for (let i = 0; i <= 7; i++) {
          const checkDate = new Date(oneWeekAgo);
          checkDate.setDate(oneWeekAgo.getDate() + i);
          const checkMonth = checkDate.getMonth() + 1;
          const checkDay = checkDate.getDate();
          
          if (checkMonth === birthdayMonth && checkDay === birthdayDay) {
            return true;
          }
        }
        
        return false;
      } else if (assignment.schedule_type === 'custom') {
        if (!assignment.date) return false;
        
        const rewardDate = new Date(assignment.date);
        const diffTime = Math.abs(today - rewardDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        // Check if date is within 7 days (past or future)
        return diffDays <= 7;
      }
      
      // For other schedule types, show all
      return true;
    });

    // Combine filtered assignments with reward details
    const rewardsWithDetails = filteredAssignments.map(assignment => ({
      ...assignment,
      reward: rewardsMap[assignment.reward_id] || null
    }));

    res.json({ rewards: rewardsWithDetails });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get user revenue from approved rewards
exports.getUserRevenue = async (req, res) => {
  try {
    // Get all users
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, first_name, last_name, email_address, profile_picture')
      .eq('role', 'user');

    if (usersError) {
      return res.status(500).json({ error: usersError.message });
    }

    // Get all approved reward assignments
    const { data: rewardAssignments, error: assignmentsError } = await supabase
      .from('rewards_assignee')
      .select('assignee_id, reward_id, quantity, updated_at')
      .eq('is_approved', true);

    if (assignmentsError) {
      return res.status(500).json({ error: assignmentsError.message });
    }

    // Get all rewards with prices
    const rewardIds = [...new Set(rewardAssignments.map(assignment => assignment.reward_id))];
    const { data: rewards, error: rewardsError } = await supabase
      .from('rewards')
      .select('id, price')
      .in('id', rewardIds);

    if (rewardsError) {
      return res.status(500).json({ error: rewardsError.message });
    }

    // Create a map of reward_id to price
    const rewardsMap = {};
    rewards.forEach(reward => {
      rewardsMap[reward.id] = reward.price || 0;
    });

    // Calculate revenue for each user
    const userRevenue = users.map(user => {
      const userAssignments = rewardAssignments.filter(assignment => 
        assignment.assignee_id === user.id
      );

      let totalQuantity = 0;
      let totalRevenue = 0;
      const rewardDetails = [];

      userAssignments.forEach(assignment => {
        const quantity = assignment.quantity || 0;
        const price = rewardsMap[assignment.reward_id] || 0;
        const revenue = quantity * price;

        totalQuantity += quantity;
        totalRevenue += revenue;

        rewardDetails.push({
          reward_id: assignment.reward_id,
          quantity: quantity,
          price: price,
          revenue: revenue,
          date: assignment.updated_at
        });
      });

      return {
        id: user.id,
        full_name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
        first_name: user.first_name,
        last_name: user.last_name,
        email_address: user.email_address,
        profile_picture: user.profile_picture,
        total_quantity: totalQuantity,
        total_revenue: totalRevenue,
        reward_details: rewardDetails
      };
    });

    res.json({ user_revenue: userRevenue });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * Upload image to AWS S3
 * POST /api/users/upload-image
 * 
 * Headers:
 * - Authorization: Bearer <token>
 * 
 * Body: multipart/form-data
 * - image: Image file (max 5MB, images only)
 * 
 * Returns:
 * - Success: { message, image_url, image_key }
 * - Error: { error: "error message" }
 */
exports.uploadProfileImage = async (req, res) => {
  try {
    // Validate environment variables
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.AWS_REGION || !process.env.AWS_S3_BUCKET) {
      return res.status(500).json({ error: 'AWS configuration is incomplete. Please check environment variables.' });
    }

    // Use the multer middleware to handle file upload
    upload.single('image')(req, res, async (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File size too large. Maximum size is 5MB.' });
          }
          return res.status(400).json({ error: `Upload error: ${err.message}` });
        }
        if (err.message === 'Invalid file type – only images allowed') {
          return res.status(400).json({ error: 'Only image files are allowed.' });
        }
        return res.status(500).json({ error: `Upload failed: ${err.message}` });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No image file provided' });
      }

      const imageUrl = req.file.location; // S3 URL
      const imageKey = req.file.key; // S3 object key

      res.json({
        message: 'Image uploaded successfully',
        image_url: imageUrl,
        image_key: imageKey
      });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

