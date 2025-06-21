// routes/authRoutes.js
import express from 'express';
import User from '../models/User.js';
import { isNotAuthenticated, isAuthenticated } from '../middleware/auth.js';
import { authenticateJWT } from '../middleware/jwtAuth.js';
import { generateToken, refreshToken } from '../services/jwtService.js';

const router = express.Router();

// Login page
router.get('/login', isNotAuthenticated, (req, res) => {
    res.render('login', { error: null });
});

// Login process
router.post('/login', isNotAuthenticated, async (req, res) => {
    try {
        const { username, password } = req.body;
        
        console.log('=== LOGIN ATTEMPT ===');
        console.log('Username:', username);
        console.log('Password provided:', password ? 'Yes' : 'No');
        
        // Validasi input
        if (!username || !password) {
            console.log('Missing username or password');
            return res.render('login', { error: 'Username and password are required' });
        }

        // Cari user
        const user = await User.findOne({ 
            where: { username: username.trim() },
            raw: false // Penting: jangan gunakan raw agar method comparePassword tersedia
        });
        
        console.log('User found:', user ? 'Yes' : 'No');
        
        if (!user) {
            console.log('User not found for username:', username);
            return res.render('login', { error: 'Invalid username or password' });
        }

        console.log('User data:', {
            id: user.id,
            username: user.username,
            hasPassword: user.password ? 'Yes' : 'No',
            passwordLength: user.password ? user.password.length : 0
        });

        // Cek password
        const isMatch = await user.comparePassword(password);
        console.log('Password verification result:', isMatch);

        if (!isMatch) {
            console.log('Password mismatch for user:', username);
            return res.render('login', { error: 'Invalid username or password' });
        }

        // Set session
        req.session.user = {
            id: user.id,
            username: user.username
        };

        console.log('Session data set:', req.session.user);

        // Save session
        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                return res.render('login', { error: 'An error occurred during login' });
            }
            console.log('=== LOGIN SUCCESSFUL ===');
            console.log('Redirecting to home page');
            res.redirect('/');
        });

    } catch (error) {
        console.error('=== LOGIN ERROR ===');
        console.error('Error details:', error);
        res.render('login', { error: 'An error occurred during login' });
    }
});

// JWT Login API endpoint
router.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        console.log('=== JWT LOGIN ATTEMPT ===');
        console.log('Username:', username);
        
        // Validasi input
        if (!username || !password) {
            return res.status(400).json({ 
                success: false,
                error: 'Username and password are required' 
            });
        }

        // Cari user
        const user = await User.findOne({ 
            where: { username: username.trim() },
            raw: false
        });
        
        if (!user) {
            return res.status(401).json({ 
                success: false,
                error: 'Invalid username or password' 
            });
        }

        // Cek password
        const isMatch = await user.comparePassword(password);
        
        if (!isMatch) {
            return res.status(401).json({ 
                success: false,
                error: 'Invalid username or password' 
            });
        }

        // Generate JWT token
        const token = generateToken(user);
        
        console.log('=== JWT LOGIN SUCCESSFUL ===');
        console.log('User:', user.username, 'Token generated');
        
        res.json({
            success: true,
            message: 'Login successful',
            data: {
                token: token,
                user: {
                    id: user.id,
                    username: user.username
                },
                expiresIn: '7d'
            }
        });

    } catch (error) {
        console.error('=== JWT LOGIN ERROR ===');
        console.error('Error details:', error);
        res.status(500).json({ 
            success: false,
            error: 'Internal server error' 
        });
    }
});

// JWT Refresh Token endpoint
router.post('/api/refresh', authenticateJWT, async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader.split(' ')[1];
        
        const newToken = refreshToken(token);
        
        if (!newToken) {
            return res.status(401).json({ 
                success: false,
                error: 'Invalid token' 
            });
        }
        
        res.json({
            success: true,
            message: 'Token refreshed successfully',
            data: {
                token: newToken,
                expiresIn: '7d'
            }
        });
        
    } catch (error) {
        console.error('Token refresh error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Internal server error' 
        });
    }
});

// JWT Logout endpoint (optional - client can just discard token)
router.post('/api/logout', authenticateJWT, async (req, res) => {
    try {
        // In a real app, you might want to blacklist the token
        // For now, just return success - client should discard token
        res.json({
            success: true,
            message: 'Logout successful'
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Internal server error' 
        });
    }
});

// Register page
router.get('/register', isNotAuthenticated, (req, res) => {
    res.render('register', { error: null });
});

// Register process
router.post('/register', isNotAuthenticated, async (req, res) => {
    try {
        const { username, password } = req.body;
        
        console.log('=== REGISTRATION ATTEMPT ===');
        console.log('Username:', username);
        
        // Validasi input
        if (!username || !password) {
            return res.render('register', { error: 'Username and password are required' });
        }
        
        if (password.length < 6) {
            return res.render('register', { error: 'Password must be at least 6 characters long' });
        }

        // Cek apakah user sudah ada
        const existingUser = await User.findOne({ where: { username: username.trim() } });
        if (existingUser) {
            return res.render('register', { error: 'Username already exists' });
        }

        // Buat user baru
        const user = await User.create({ 
            username: username.trim(), 
            password: password 
        });
        
        console.log('User registered successfully:', user.username);
        console.log('=== REGISTRATION SUCCESSFUL ===');
        
        res.redirect('/auth/login');
    } catch (error) {
        console.error('=== REGISTRATION ERROR ===');
        console.error('Error details:', error);
        res.render('register', { error: 'An error occurred during registration' });
    }
});

// Logout
router.get('/logout', isAuthenticated, (req, res) => {
    console.log('=== LOGOUT ATTEMPT ===');
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
        } else {
            console.log('Session destroyed successfully');
        }
        res.redirect('/auth/login');
    });
});

export default router;