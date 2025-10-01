require('dotenv').config();
const express = require('express');
const cors = require('cors');
const advisorRoutes = require('./routes/advisor');
const merchantRoutes = require('./routes/merchant');
const userRoutes = require('./routes/user');
const privacyPolicyRoutes = require('./routes/privacyPolicy');
const termsConditionsRoutes = require('./routes/termsConditions');
const userFinancesRoutes = require('./routes/userFinances');
const analyticsRoutes = require('./routes/analytics');
const { scheduleChallengeCronJob } = require('./utils/cronJobs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('API is running');
});

// userFinancesRoutes includes /transactions/create and /transactions for transaction AI create/read
app.use('/api/user-finances', userFinancesRoutes);
app.use('/api/advisor', advisorRoutes);
app.use('/api/merchant', merchantRoutes);
app.use('/api/rewards', require('./routes/reward'));
app.use('/api/wrappings', require('./routes/wrapping'));
app.use('/api/challenges', require('./routes/challenge'));
app.use('/api/transactions', require('./routes/transaction'));
app.use('/api/reward-assignee', require('./routes/rewardAssignee'));
app.use('/api/user', userRoutes);
app.use('/api/privacy-policy', privacyPolicyRoutes);
app.use('/api/terms-conditions', termsConditionsRoutes);
app.use('/api/goals-savings', require('./routes/goals'));
app.use('/api/analytics', analyticsRoutes);
app.get('/referral/:code', (req, res) => {
  const referralCode = req.params.code;

  const ua = req.headers['user-agent'];
  if (/iPhone|iPad|iPod/i.test(ua)) {
    return res.redirect('https://apps.apple.com/us/app/moneykakis/id6748995138?platform=iphone');
  } else if (/Android/i.test(ua)) {
    return res.redirect('https://play.google.com/store/apps/details?id=com.finance.moneykakis'); // once live
  } else {
    // Optional: show a landing page
    return res.send('Open this link on your phone to install the MoneyKakis app.');
  }
});

// Initialize cron jobs
scheduleChallengeCronJob();

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 