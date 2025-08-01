const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.user = decoded; // Add user info to request object
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = { verifyToken }; 