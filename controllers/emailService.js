const FormData = require('form-data');
const Mailgun = require('mailgun.js');

const mailgun = new Mailgun(FormData);
const mg = mailgun.client({
  username: 'api',
  key: process.env.API_KEY || 'API_KEY',
  // url: process.env.MAILGUN_URL || undefined, // Uncomment if using EU domain
});
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN || 'mail.first-4.com';
const FROM_EMAIL = process.env.FROM_EMAIL || 'Mailgun Sandbox <postmaster@mail.first-4.com>';

const sendAdvisorVerificationEmail = async (advisorName, email, code) => {
  console.log(advisorName, email, code);
  if (!advisorName || !email || !code) {
    return { error: 'Missing required fields.' };
  }

  const subject = 'Your Advisor Verification Code';
  const emailBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
      <div style="background-color: #1976d2; padding: 20px; text-align: center;">
        <h1 style="color: #fff; margin: 0;">Money Kaki</h1>
      </div>
      <div style="padding: 20px; color: #333;">
        <h2>Hello ${advisorName},</h2>
        <p>Thank you for registering as an advisor. Please use the following verification code to verify your email address:</p>
        <div style="font-size: 32px; font-weight: bold; color: #1976d2; margin: 20px 0;">${code}</div>
        <p>If you did not request this, please ignore this email.</p>
        <p>Best regards,<br>Money Kaki Team</p>
      </div>
    </div>
  `;

  try {
    const data = await mg.messages.create(MAILGUN_DOMAIN, {
      from: FROM_EMAIL,
      to: [email],
      subject,
      html: emailBody,
    });
    console.log('Verification email sent:', data);
    return { message: 'Verification email sent.' };
  } catch (error) {
    console.error('Error sending verification email:', error);
    return { error: 'Failed to send verification email' };
  }
};

const sendPasswordResetEmail = async (advisorName, email, code) => {
  if (!advisorName || !email || !code) {
    return { error: 'Missing required fields.' };
  }

  const subject = 'Password Reset Code';
  const emailBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
      <div style="background-color: #1976d2; padding: 20px; text-align: center;">
        <h1 style="color: #fff; margin: 0;">Money Kaki</h1>
      </div>
      <div style="padding: 20px; color: #333;">
        <h2>Hello ${advisorName},</h2>
        <p>You have requested to reset your password. Please use the following code to reset your password:</p>
        <div style="font-size: 32px; font-weight: bold; color: #1976d2; margin: 20px 0;">${code}</div>
        <p>This code will expire in 10 minutes.</p>
        <p>If you did not request this, please ignore this email and ensure your account is secure.</p>
        <p>Best regards,<br>Money Kaki Team</p>
      </div>
    </div>
  `;

  try {
    const data = await mg.messages.create(MAILGUN_DOMAIN, {
      from: FROM_EMAIL,
      to: [email],
      subject,
      html: emailBody,
    });
    console.log('Password reset email sent:', data);
    return { message: 'Password reset email sent.' };
  } catch (error) {
    console.error('Error sending password reset email:', error);
    return { error: 'Failed to send password reset email' };
  }
};

module.exports = { sendAdvisorVerificationEmail, sendPasswordResetEmail }; 