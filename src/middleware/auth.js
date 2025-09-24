const jwt = require('jsonwebtoken');
require('dotenv').config();

function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ message: 'No token' });

  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Invalid token' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    // Issue a new token with a refreshed expiration time
    const newToken = jwt.sign(
      { id: decoded.id, role: decoded.role, username: decoded.username },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );
    res.setHeader('x-auth-token', newToken);

    next();
  } catch (err) {
    return res.status(403).json({ message: 'Token invalid' });
  }
}

module.exports = authMiddleware;
