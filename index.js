require('dotenv').config();
const express = require('express');
const cors = require('cors');
const advisorRoutes = require('./routes/advisor');
const merchantRoutes = require('./routes/merchant');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('API is running');
});

app.use('/api/advisor', advisorRoutes);
app.use('/api/merchant', merchantRoutes);
app.use('/api/rewards', require('./routes/reward'));
app.use('/api/wrappings', require('./routes/wrapping'));

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 