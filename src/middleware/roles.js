function authorize(roles = []) {
  if (typeof roles === 'string') {
    roles = [roles];
  }

  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({ message: 'Authentication error: User data is missing.' });
    }

    const userRole = req.user.role.toLowerCase();
    const requiredRoles = roles.map(role => role.toLowerCase());

    if (requiredRoles.length && !requiredRoles.includes(userRole)) {
      return res.status(403).json({ message: 'Forbidden: You do not have permission to perform this action.' });
    }

    next();
  };
}

module.exports = authorize;
