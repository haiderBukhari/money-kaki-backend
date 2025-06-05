const nodemailer = require('nodemailer');

const sendAdvisorVerificationEmail = async (advisorName, email, code) => {
  if (!advisorName || !email || !code) {
    return { error: 'Missing required fields.' };
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: process.env.EMAIL_HOST,
      clientId: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      refreshToken: process.env.OAUTH_REFRESH_TOKEN,
    },
  });

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

  const mailOptions = {
    from: process.env.EMAIL_HOST,
    to: email,
    subject,
    html: emailBody,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Verification email sent:', info.response);
    return { message: 'Verification email sent.' };
  } catch (error) {
    console.error('Error sending verification email:', error);
    return { error: 'Failed to send verification email' };
  }
};

module.exports = { sendAdvisorVerificationEmail }; 