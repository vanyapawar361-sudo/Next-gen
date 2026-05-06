/**
 * Middleware to simulate Role-Based Access Control (RBAC).
 * Expects 'x-user-role' header.
 */
const roles = {
  ADMIN: 'Admin',
  EMPLOYEE: 'Employee',
  HR: 'HR',
  DEVELOPER: 'Developer'
};

const authorize = (allowedRoles = []) => {
  return (req, res, next) => {
    const userRole = req.headers['x-user-role'];

    if (!userRole) {
      return res.status(401).json({ error: 'Unauthorized: User role missing in headers' });
    }

    // Admin has access to everything
    if (userRole === roles.ADMIN) {
      return next();
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
      return res.status(403).json({ error: `Forbidden: This resource requires one of the following roles: ${allowedRoles.join(', ')}` });
    }

    next();
  };
};

module.exports = {
  authorize,
  roles
};
