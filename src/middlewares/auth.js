const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * Middleware to verify JWT and attach user context to request.
 */
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    req.user = decoded; // { id, role, department }
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
};

/**
 * Middleware to restrict access based on roles.
 */
const authorize = (allowedRoles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized: User context missing' });
    }

    if (req.user.role === 'Admin') {
      return next(); // Admin bypassed RBAC
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: `Forbidden: This resource requires one of [${allowedRoles.join(', ')}] roles` });
    }

    next();
  };
};

module.exports = {
  authenticate,
  authorize
};
