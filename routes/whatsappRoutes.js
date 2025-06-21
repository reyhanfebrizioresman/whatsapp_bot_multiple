import express from 'express';
import {
  testConnection,
  sendMessage,
  sendBulkMessage,
  getSessionStatus,
  checkNumberExists,
  getProfilePicture
} from '../controllers/whatsappController.js';
import { authenticateJWT } from '../middleware/jwtAuth.js';

const router = express.Router();

// Test connection endpoint
router.get('/test/:token', authenticateJWT, testConnection);

// Get session status
router.get('/status/:token', authenticateJWT, getSessionStatus);

// Send single message
router.post('/send/:token', authenticateJWT, sendMessage);

// Send bulk messages
router.post('/bulk-send/:token', authenticateJWT, sendBulkMessage);

// Check if number exists on WhatsApp
router.post('/check-number/:token', authenticateJWT, checkNumberExists);

// Get profile picture
router.get('/profile-picture/:token', authenticateJWT, getProfilePicture);

export default router;