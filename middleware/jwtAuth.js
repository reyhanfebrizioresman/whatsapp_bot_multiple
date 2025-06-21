import { verifyToken } from '../services/jwtService.js';

export const authenticateJWT = (req, res, next) => {
    try {
        // Get token from header
        const authHeader = req.headers.authorization;
        
        if (!authHeader) {
            return res.status(401).json({ 
                error: 'Authentication required',
                message: 'No token provided. Please login first.' 
            });
        }

        // Check if it's Bearer token
        const parts = authHeader.split(' ');
        if (parts.length !== 2 || parts[0] !== 'Bearer') {
            return res.status(401).json({ 
                error: 'Invalid token format',
                message: 'Token must be in format: Bearer <token>' 
            });
        }

        const token = parts[1];
        
        // Verify token
        const { valid, decoded, error } = verifyToken(token);
        
        if (!valid) {
            return res.status(401).json({ 
                error: 'Invalid token',
                message: error || 'Token is invalid or expired' 
            });
        }

        // Add user info to request
        req.user = decoded;
        next();
    } catch (error) {
        console.error('JWT Authentication error:', error);
        return res.status(500).json({ 
            error: 'Authentication error',
            message: 'Internal server error during authentication' 
        });
    }
};

export const optionalJWT = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader) {
            return next(); // Continue without authentication
        }

        const parts = authHeader.split(' ');
        if (parts.length !== 2 || parts[0] !== 'Bearer') {
            return next(); // Continue without authentication
        }

        const token = parts[1];
        const { valid, decoded } = verifyToken(token);
        
        if (valid) {
            req.user = decoded;
        }
        
        next();
    } catch (error) {
        next(); // Continue without authentication
    }
}; 