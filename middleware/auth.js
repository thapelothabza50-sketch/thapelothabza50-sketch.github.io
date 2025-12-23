// middleware/auth.js (FINAL AND CORRECTED VERSION)

const jwt = require('jsonwebtoken');
require('dotenv').config();

// --------------------------------------------------------
// 1. Authentication Middleware
// --------------------------------------------------------
function auth(req, res, next) {
    // Safely extract token and remove "Bearer " prefix
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ message: 'No token, authorization denied.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // The decoded payload ({ id: '...', role: '...' }) is assigned directly to req.user.
        req.user = decoded; 
        
        if (!req.user || !req.user.role || !req.user.id) {
             return res.status(401).json({ message: 'Token is valid, but missing required user details (id or role).' });
        }
        
        next();

    } catch (err) {
        // Catches invalid signature, expiration, etc.
        res.status(401).json({ message: 'Token is not valid or has expired.' });
    }
}


// --------------------------------------------------------
// 2. Generic Role-Based Access Control Middleware (CASE-INSENSITIVE FIX)
// --------------------------------------------------------
function hasRole(requiredRoles) {
    // Convert the list of required roles to lowercase once
    const lowerRequiredRoles = requiredRoles.map(role => role.toLowerCase());

    // Return the actual Express middleware function
    return (req, res, next) => {
        if (!req.user || !req.user.role) {
            return res.status(403).json({ message: 'Access denied. User role could not be verified.' });
        }
        
        // Convert the user's role to lowercase for comparison
        const userRoleLower = req.user.role.toLowerCase();
        
        // Check if the user's lowercase role is in the list of lowercase required roles
        if (lowerRequiredRoles.includes(userRoleLower)) {
            next(); // Role is authorized, proceed
        } else {
            // 403 Forbidden - Insufficient privileges
            return res.status(403).json({ message: 'Access denied. Insufficient privileges.' });
        }
    };
}

module.exports = { auth, hasRole };