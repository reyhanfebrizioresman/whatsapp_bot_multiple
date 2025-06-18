import express from 'express';
import {
  testConnection,
  sendMessage,
  sendBulkMessage,
  getSessionStatus,
  checkNumberExists,
  getProfilePicture
} from '../controllers/whatsappController.js';
import { isAuthenticated } from '../middleware/auth.js';

const router = express.Router();

// Test connection endpoint
router.get('/test/:token', isAuthenticated, testConnection);

// Get session status
router.get('/status/:token', isAuthenticated, getSessionStatus);

// Send single message
router.post('/send/:token', isAuthenticated, sendMessage);

// Send bulk messages
router.post('/bulk-send/:token', isAuthenticated, sendBulkMessage);

// Check if number exists on WhatsApp
router.post('/check-number/:token', isAuthenticated, checkNumberExists);

// Get profile picture
router.get('/profile-picture/:token', isAuthenticated, getProfilePicture);

export default router;