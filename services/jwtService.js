import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'; // 7 days default

export const generateToken = (user) => {
    const payload = {
        id: user.id,
        username: user.username,
        iat: Math.floor(Date.now() / 1000)
    };

    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

export const verifyToken = (token) => {
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        return { valid: true, decoded };
    } catch (error) {
        return { valid: false, error: error.message };
    }
};

export const decodeToken = (token) => {
    try {
        return jwt.decode(token);
    } catch (error) {
        return null;
    }
};

export const refreshToken = (token) => {
    const decoded = decodeToken(token);
    if (decoded) {
        return generateToken({ id: decoded.id, username: decoded.username });
    }
    return null;
}; 