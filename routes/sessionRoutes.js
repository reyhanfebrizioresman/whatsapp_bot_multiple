import express from 'express';
import {
  showSessionList,
  handleCreateSession,
  handleStartSession,
  checkSessionStatus,
  restartSession,
  refreshQR,
  deleteSession,
  handleLogout,
} from '../controllers/sessionController.js';
import { isAuthenticated } from '../middleware/auth.js';

const router = express.Router();

// Dashboard route
router.get('/', isAuthenticated, showSessionList);

// JSON endpoint for fetching sessions (for frontend AJAX calls)
router.get('/sessions', isAuthenticated, async (req, res) => {
  try {
    const { getAllSessions } = await import('../models/sessionModel.js');
    const { getSessionInfo } = await import('../services/whatsappService.js');
    
    const sessions = await getAllSessions();
    const sessionsWithInfo = sessions.map(session => ({
      ...session,
      info: getSessionInfo(session.token)
    }));
    
    res.json(sessionsWithInfo);
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Failed to load sessions' });
  }
});

// Session management routes
router.post('/session', isAuthenticated, handleCreateSession);

// WhatsApp session routes
router.post('/session/start/:token', isAuthenticated, handleStartSession);
router.get('/session/status/:token', isAuthenticated, checkSessionStatus);
router.post('/session/restart/:token', isAuthenticated, restartSession);
router.post('/session/refresh/:token', isAuthenticated, refreshQR);
router.delete('/session/:token', isAuthenticated, deleteSession);

// Logout route
router.post('/logout', isAuthenticated, handleLogout);

export default router;