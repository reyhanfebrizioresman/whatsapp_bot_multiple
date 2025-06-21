import { v4 as uuidv4 } from 'uuid';
import {
  createSession,
  getAllSessions,
  getSessionByToken,
  clearSession,
  deleteSession as deleteSessionDB,
  updateSessionStatus
} from '../models/sessionModel.js';
import { 
  startWhatsAppSession, 
  closeSocket, 
  getSessionInfo, 
  getActiveSessions,
  cleanupInactiveSessions,
  forceCleanupSession,
  resetSessionReconnectAttempts
} from '../services/whatsappService.js';
import fs from 'fs';
import path from 'path';

export const showSessionList = async (req, res) => {
  try {
    const sessions = await getAllSessions();
    // Add session info for each session
    const sessionsWithInfo = sessions.map(session => {
      const sessionInfo = getSessionInfo(session.token);
      return {
        ...session,
        session_status: session.status, // Add session_status field
        isReady: sessionInfo.isReady, // Add isReady field
        jid: sessionInfo.jid,
        userName: sessionInfo.name,
        connectionStatus: sessionInfo.status,
        info: sessionInfo // Keep original info for backward compatibility
      };
    });
    res.render('index', { sessions: sessionsWithInfo });
  } catch (error) {
    console.error('Error loading sessions:', error);
    res.status(500).send('Error loading sessions');
  }
};

export const handleCreateSession = async (req, res) => {
  try {
    const token = uuidv4();
    const name = req.body.name || `Session-${Date.now()}`;
    
    console.log(`Creating new session: ${name} with token: ${token}`);
    
    await createSession(token, name);
    
    res.json({
      success: true,
      token: token,
      name: name,
      message: 'Session created successfully'
    });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error creating session',
      details: error.message 
    });
  }
};

export const handleStartSession = async (req, res) => {
  const token = req.params.token;
  
  try {
    console.log(`Starting session request for token: ${token}`);
    
    // Validate token exists
    const session = await getSessionByToken(token);
    if (!session) {
      return res.status(404).json({ 
        success: false,
        error: 'Session not found. Please create a new session.',
        token: null 
      });
    }

    // Check current session status
    const currentSessionInfo = getSessionInfo(token);
    console.log(`Current session info for ${token}:`, currentSessionInfo);
    
    // If session is already connected, return success immediately
    if (currentSessionInfo.isReady) {
      console.log(`Session ${token} is already connected, returning success`);
      return res.json({
        success: true,
        status: 'connected',
        message: 'WhatsApp session is already connected!',
        token: token,
        sessionName: session.name,
        jid: currentSessionInfo.jid,
        userName: currentSessionInfo.name
      });
    }

    // Force cleanup any existing problematic connection
    console.log(`Force cleaning up existing connection for token: ${token}`);
    forceCleanupSession(token);
    
    // Add a delay to ensure clean closure
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Update session status to connecting
    await updateSessionStatus(token, 'connecting');

    // Set response timeout
    const TIMEOUT_MS = 90000; // 90 seconds - increased timeout
    let timeoutId;
    let qrGenerated = false;
    let responseHandled = false;

    // Cleanup function
    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };

    // Handle client disconnect
    req.on('close', () => {
      console.log(`Client disconnected for token ${token}`);
      cleanup();
      responseHandled = true;
    });

    // Enhanced timeout handler
    const handleTimeout = () => {
      if (!qrGenerated && !responseHandled && !res.headersSent) {
        console.log(`QR generation timeout for token ${token}`);
        responseHandled = true;
        updateSessionStatus(token, 'timeout').catch(console.error);
        res.status(408).json({ 
          success: false,
          error: 'QR code generation timeout. Please check your internet connection and try again.',
          token: token,
          canRetry: true
        });
      }
      cleanup();
    };

    // Set timeout
    timeoutId = setTimeout(handleTimeout, TIMEOUT_MS);

    console.log(`Starting WhatsApp session for token ${token}`);
    
    // Start session with enhanced error handling
    try {
      const socket = await startWhatsAppSession(token, (qr) => {
        if (!qrGenerated && !responseHandled && !res.headersSent) {
          qrGenerated = true;
          responseHandled = true;
          cleanup();
          
          console.log(`QR Code generated successfully for token ${token}`);
          console.log(`QR Data length: ${qr.length}`);
          
          // Update session status
          updateSessionStatus(token, 'qr_ready').catch(console.error);
          
          res.json({ 
            success: true,
            status: 'qr_generated',
            qr: qr,
            token: token,
            sessionName: session.name,
            message: 'QR Code generated successfully. Please scan with WhatsApp mobile app.'
          });
        }
      });

      if (!socket) {
        throw new Error('Failed to create WhatsApp socket - socket is null');
      }

      // Enhanced waiting logic with status updates
      const statusCheckInterval = setInterval(() => {
        if (responseHandled) {
          clearInterval(statusCheckInterval);
          return;
        }
        
        const sessionInfo = getSessionInfo(token);
        console.log(`Session ${token} status check:`, sessionInfo);
        
        if (sessionInfo.isReady && !responseHandled && !res.headersSent) {
          responseHandled = true;
          cleanup();
          clearInterval(statusCheckInterval);
          
          updateSessionStatus(token, 'connected').catch(console.error);
          
          res.json({
            success: true,
            status: 'connected',
            message: 'WhatsApp session connected successfully!',
            token: token,
            sessionName: session.name,
            jid: sessionInfo.jid,
            userName: sessionInfo.name
          });
        }
      }, 2000);

      // Fallback response if no QR after 30 seconds
      setTimeout(() => {
        if (!qrGenerated && !responseHandled && !res.headersSent) {
          console.log(`Still waiting for QR generation for token ${token}`);
          responseHandled = true;
          cleanup();
          
          res.json({
            success: true,
            status: 'connecting',
            message: 'Connecting to WhatsApp servers... This may take up to 90 seconds. Please wait.',
            token: token,
            sessionName: session.name
          });
        }
      }, 30000); // 30 seconds

    } catch (socketError) {
      cleanup();
      console.error(`Socket creation error for token ${token}:`, socketError);
      
      if (!responseHandled && !res.headersSent) {
        responseHandled = true;
        
        // Update session status
        await updateSessionStatus(token, 'error');
        
        // Determine error type and provide appropriate message
        let errorMessage = 'Failed to connect to WhatsApp servers.';
        let canRetry = true;
        
        if (socketError.message.includes('ENOTFOUND') || socketError.message.includes('getaddrinfo')) {
          errorMessage = 'Network connection error. Please check your internet connection and try again.';
        } else if (socketError.message.includes('timeout')) {
          errorMessage = 'Connection timeout. WhatsApp servers may be busy. Please try again in a few moments.';
        } else if (socketError.message.includes('unauthorized') || socketError.message.includes('401')) {
          errorMessage = 'Authorization error. Session will be reset.';
          canRetry = false;
          await clearSession(token);
        } else if (socketError.message.includes('rate') || socketError.message.includes('429')) {
          errorMessage = 'Too many requests. Please wait a few minutes before trying again.';
        } else if (socketError.message.includes('makeWASocket is not a function')) {
          errorMessage = 'WhatsApp library initialization error. Please check server configuration.';
          canRetry = false;
        }
        
        res.status(500).json({ 
          success: false,
          error: errorMessage,
          details: socketError.message,
          token: token,
          canRetry: canRetry
        });
      }
    }

  } catch (error) {
    console.error(`Error in handleStartSession for token ${token}:`, error);
    
    if (!res.headersSent) {
      // Update session status
      updateSessionStatus(token, 'error').catch(console.error);
      
      res.status(500).json({ 
        success: false,
        error: `Unexpected error: ${error.message}. Please try again or create a new session.`,
        details: error.message,
        token: token,
        canRetry: true
      });
    }
  }
};

// Enhanced session status check
export const checkSessionStatus = async (req, res) => {
  const token = req.params.token;
  
  try {
    const session = await getSessionByToken(token);
    if (!session) {
      return res.status(404).json({ 
        success: false,
        error: 'Session not found' 
      });
    }

    const sessionInfo = getSessionInfo(token);
    
    // Auto-update database status if session is connected but DB shows different status
    if (sessionInfo.isReady && session.status !== 'connected') {
      await updateSessionStatus(token, 'connected');
      session.status = 'connected';
    } else if (sessionInfo.status === 'disconnected' && session.status !== 'disconnected') {
      await updateSessionStatus(token, 'disconnected');
      session.status = 'disconnected';
    }
    
    // Return data in the format expected by frontend
    res.json({
      success: true,
      token: session.token,
      name: session.name,
      session_status: session.status, // This is what frontend expects
      lastUpdate: session.updated_at,
      hasCredentials: !!(session.creds && session.creds.trim()),
      hasKeys: !!(session.keys && session.keys.trim()),
      isReady: sessionInfo.isReady, // This is what frontend expects
      jid: sessionInfo.jid || null,
      userName: sessionInfo.name || null,
      connectionStatus: sessionInfo.status,
      status: sessionInfo.status // Additional status field
    });
  } catch (error) {
    console.error('Error checking session status:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      details: error.message 
    });
  }
};

// Enhanced restart session 
export const restartSession = async (req, res) => {
  const token = req.params.token;
  
  try {
    const session = await getSessionByToken(token);
    if (!session) {
      return res.status(404).json({ 
        success: false,
        error: 'Session not found' 
      });
    }

    console.log(`Restarting session ${token}...`);
    
    // Close existing socket with delay
    closeSocket(token);
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Clear session data
    await clearSession(token);
    
    // Update status
    await updateSessionStatus(token, 'restarted');
    
    console.log(`Session ${token} restarted successfully`);
    
    res.json({ 
      success: true,
      message: 'Session restarted successfully. You can now start the session again.',
      token: token
    });
  } catch (error) {
    console.error('Error restarting session:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        success: false,
        error: 'Error restarting session',
        details: error.message 
      });
    }
  }
};

// Enhanced delete session
export const deleteSession = async (req, res) => {
  const token = req.params.token;
  
  try {
    const session = await getSessionByToken(token);
    if (!session) {
      return res.status(404).json({ 
        success: false,
        error: 'Session not found' 
      });
    }

    console.log(`Deleting session ${token}...`);
    
    // Close socket
    closeSocket(token);
    
    // Delete from database
    await deleteSessionDB(token);
    
    // Clean up session files
    const sessionPath = path.join('./sessions', token);
    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true });
      console.log(`Session files deleted for token ${token}`);
    }
    
    console.log(`Session ${token} deleted successfully`);
    res.json({ 
      success: true,
      message: 'Session deleted successfully',
      token: token
    });
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error deleting session',
      details: error.message 
    });
  }
};

// Force refresh QR
export const refreshQR = async (req, res) => {
  const token = req.params.token;
  
  try {
    const session = await getSessionByToken(token);
    if (!session) {
      return res.status(404).json({ 
        success: false,
        error: 'Session not found' 
      });
    }

    console.log(`Refreshing QR for session ${token}...`);
    
    // Close and restart session
    closeSocket(token);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Update status
    await updateSessionStatus(token, 'refreshing');
    
    res.json({ 
      success: true,
      message: 'Session refreshed successfully. Please start the session again to get a new QR code.',
      token: token
    });
  } catch (error) {
    console.error('Error refreshing QR:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error refreshing QR code',
      details: error.message 
    });
  }
};

// Get all active sessions
export const getActiveSessionsList = async (req, res) => {
  try {
    const activeSessions = getActiveSessions();
    const dbSessions = await getAllSessions();
    
    const combinedSessions = dbSessions.map(dbSession => {
      const activeSession = activeSessions.find(s => s.sessionId === dbSession.token);
      return {
        ...dbSession,
        active: !!activeSession,
        connectionStatus: activeSession?.status || 'disconnected',
        hasQR: activeSession?.hasQR || false,
        isReady: activeSession?.isReady || false
      };
    });
    
    res.json({
      success: true,
      data: combinedSessions,
      summary: {
        total: combinedSessions.length,
        active: activeSessions.length,
        connected: activeSessions.filter(s => s.isReady).length
      }
    });
  } catch (error) {
    console.error('Error getting active sessions:', error);
    res.status(500).json({
      success: false,
      error: 'Error getting active sessions',
      details: error.message
    });
  }
};

// Cleanup inactive sessions endpoint
export const cleanupSessions = async (req, res) => {
  try {
    cleanupInactiveSessions();
    res.json({
      success: true,
      message: 'Inactive sessions cleaned up successfully'
    });
  } catch (error) {
    console.error('Error cleaning up sessions:', error);
    res.status(500).json({
      success: false,
      error: 'Error cleaning up sessions',
      details: error.message
    });
  }
};

// Logout route
export const handleLogout = async (req, res) => {
  try {
    // Destroy session
    req.session.destroy((err) => {
      if (err) {
        console.error('Logout error:', err);
        return res.status(500).json({ 
          success: false,
          error: 'Error during logout' 
        });
      }
      
      // Clear session cookie
      res.clearCookie('connect.sid');
      
      // Check if it's AJAX request
      if (req.xhr || req.headers.accept && req.headers.accept.indexOf('json') > -1) {
        res.json({ 
          success: true,
          message: 'Logged out successfully',
          redirect: '/auth/login'
        });
      } else {
        res.redirect('/auth/login');
      }
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error during logout',
      details: error.message 
    });
  }
};

export const forceCleanupSessionController = async (req, res) => {
  const token = req.params.token;
  
  try {
    console.log(`Force cleanup request for session: ${token}`);
    
    // Validate token exists
    const session = await getSessionByToken(token);
    if (!session) {
      return res.status(404).json({ 
        success: false,
        error: 'Session not found.',
        token: null 
      });
    }

    // Force cleanup the session
    const cleaned = forceCleanupSession(token);
    
    if (cleaned) {
      console.log(`Successfully force cleaned session: ${token}`);
      res.json({
        success: true,
        message: 'Session force cleaned successfully',
        token: token
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to force clean session',
        token: token
      });
    }
  } catch (error) {
    console.error('Error force cleaning session:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error force cleaning session',
      details: error.message 
    });
  }
};

export const resetReconnectAttempts = async (req, res) => {
  const token = req.params.token;
  
  try {
    console.log(`Reset reconnect attempts request for session: ${token}`);
    
    // Validate token exists
    const session = await getSessionByToken(token);
    if (!session) {
      return res.status(404).json({ 
        success: false,
        error: 'Session not found.',
        token: null 
      });
    }

    // Reset reconnect attempts
    const reset = resetSessionReconnectAttempts(token);
    
    if (reset) {
      console.log(`Successfully reset reconnect attempts for session: ${token}`);
      res.json({
        success: true,
        message: 'Reconnect attempts reset successfully',
        token: token
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Session not found in active connections',
        token: token
      });
    }
  } catch (error) {
    console.error('Error resetting reconnect attempts:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error resetting reconnect attempts',
      details: error.message 
    });
  }
};