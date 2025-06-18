// Import from your existing services
import { getActiveSocket, getSessionInfo, isSessionReady } from '../services/whatsappService.js';
import { getSessionByToken } from '../models/sessionModel.js';

// Test connection
export const testConnection = async (req, res) => {
  try {
    const { token } = req.params;
    
    console.log(`Testing connection for token: ${token}`);
    
    // Validate token
    const session = await getSessionByToken(token);
    if (!session) {
      return res.status(404).json({ 
        error: 'Session not found' 
      });
    }

    // Get session info using your existing function
    const sessionInfo = getSessionInfo(token);
    const socket = getActiveSocket(token);
    
    if (!socket) {
      return res.status(400).json({ 
        error: 'WhatsApp session not active',
        sessionInfo: sessionInfo
      });
    }

    if (!sessionInfo.isReady) {
      return res.status(400).json({ 
        error: 'WhatsApp session not ready. Please scan QR code first.',
        sessionInfo: sessionInfo
      });
    }

    res.json({
      success: true,
      message: 'WhatsApp session is connected and ready',
      session: {
        token: session.token,
        name: session.name,
        status: session.status,
        jid: sessionInfo.jid,
        userName: sessionInfo.name,
        isReady: sessionInfo.isReady
      }
    });

  } catch (error) {
    console.error('Error testing connection:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
};

// Send message
export const sendMessage = async (req, res) => {
  try {
    const { token } = req.params;
    const { number, message, type = 'text' } = req.body;

    console.log(`Send message request for token ${token}:`, { number, type, messageLength: message?.length });

    // Validate input
    if (!number || !message) {
      return res.status(400).json({ 
        error: 'Number and message are required' 
      });
    }

    // Validate token
    const session = await getSessionByToken(token);
    if (!session) {
      return res.status(404).json({ 
        error: 'Session not found' 
      });
    }

    // Get active socket using your existing function
    const socket = getActiveSocket(token);
    if (!socket) {
      return res.status(400).json({ 
        error: 'WhatsApp session not active. Please start the session first.' 
      });
    }

    // Check if session is ready
    if (!isSessionReady(token)) {
      return res.status(400).json({ 
        error: 'WhatsApp session not ready. Please scan QR code first.' 
      });
    }

    // Format phone number
    const phoneNumber = formatPhoneNumber(number);
    console.log(`Formatted phone number: ${phoneNumber}`);

    let messageData;
    let sentMessage;

    try {
      switch (type.toLowerCase()) {
        case 'text':
          messageData = { text: message };
          sentMessage = await socket.sendMessage(phoneNumber, messageData);
          break;

        case 'image':
          // Handle image message
          if (isValidUrl(message)) {
            messageData = { 
              image: { url: message },
              caption: req.body.caption || ''
            };
          } else {
            // Assume it's base64
            messageData = { 
              image: Buffer.from(message, 'base64'),
              caption: req.body.caption || ''
            };
          }
          sentMessage = await socket.sendMessage(phoneNumber, messageData);
          break;

        case 'document':
          if (isValidUrl(message)) {
            messageData = { 
              document: { url: message },
              fileName: req.body.fileName || 'document.pdf',
              mimetype: req.body.mimetype || 'application/pdf'
            };
          } else {
            messageData = { 
              document: Buffer.from(message, 'base64'),
              fileName: req.body.fileName || 'document.pdf',
              mimetype: req.body.mimetype || 'application/pdf'
            };
          }
          sentMessage = await socket.sendMessage(phoneNumber, messageData);
          break;

        default:
          return res.status(400).json({ 
            error: 'Unsupported message type. Supported types: text, image, document' 
          });
      }

      console.log(`Message sent successfully for token ${token}`, sentMessage.key);

      res.json({
        success: true,
        message: 'Message sent successfully',
        data: {
          messageId: sentMessage.key.id,
          to: phoneNumber,
          type: type,
          timestamp: new Date().toISOString(),
          status: sentMessage.status || 'sent'
        }
      });

    } catch (sendError) {
      console.error(`Error sending message:`, sendError);
      throw sendError;
    }

  } catch (error) {
    console.error(`Error sending message for token ${req.params.token}:`, error);
    
    let errorMessage = 'Failed to send message';
    let statusCode = 500;

    if (error.message.includes('not-authorized') || error.message.includes('401')) {
      errorMessage = 'WhatsApp session not authorized. Please reconnect.';
      statusCode = 401;
    } else if (error.message.includes('recipient not found') || error.message.includes('404')) {
      errorMessage = 'Recipient phone number not found on WhatsApp';
      statusCode = 404;
    } else if (error.message.includes('rate limit') || error.message.includes('429')) {
      errorMessage = 'Rate limit exceeded. Please try again later.';
      statusCode = 429;
    } else if (error.message.includes('timeout')) {
      errorMessage = 'Message sending timeout. Please try again.';
      statusCode = 408;
    }

    res.status(statusCode).json({ 
      error: errorMessage,
      details: error.message 
    });
  }
};

// Send bulk messages
export const sendBulkMessage = async (req, res) => {
  try {
    const { token } = req.params;
    const { numbers, message, type = 'text', delay = 2000 } = req.body;

    console.log(`Bulk message request for token ${token}:`, { 
      numbersCount: numbers?.length, 
      type, 
      delay 
    });

    // Validate input
    if (!numbers || !Array.isArray(numbers) || numbers.length === 0) {
      return res.status(400).json({ 
        error: 'Numbers array is required and must not be empty' 
      });
    }

    if (!message) {
      return res.status(400).json({ 
        error: 'Message is required' 
      });
    }

    if (numbers.length > 50) { // Reduced limit for safety
      return res.status(400).json({ 
        error: 'Maximum 50 numbers allowed per bulk send' 
      });
    }

    // Validate token
    const session = await getSessionByToken(token);
    if (!session) {
      return res.status(404).json({ 
        error: 'Session not found' 
      });
    }

    // Get active socket
    const socket = getActiveSocket(token);
    if (!socket || !isSessionReady(token)) {
      return res.status(400).json({ 
        error: 'WhatsApp session not ready. Please scan QR code first.' 
      });
    }

    const results = [];
    const errors = [];

    // Process each number with delay
    for (let i = 0; i < numbers.length; i++) {
      try {
        const phoneNumber = formatPhoneNumber(numbers[i]);
        
        let messageData;
        switch (type.toLowerCase()) {
          case 'text':
            messageData = { text: message };
            break;
          case 'image':
            if (isValidUrl(message)) {
              messageData = { 
                image: { url: message },
                caption: req.body.caption || ''
              };
            } else {
              messageData = { 
                image: Buffer.from(message, 'base64'),
                caption: req.body.caption || ''
              };
            }
            break;
          default:
            throw new Error('Unsupported message type for bulk send. Use text or image.');
        }

        const sentMessage = await socket.sendMessage(phoneNumber, messageData);
        
        results.push({
          number: numbers[i],
          formatted: phoneNumber,
          status: 'sent',
          messageId: sentMessage.key.id,
          timestamp: new Date().toISOString()
        });

        console.log(`Bulk message ${i + 1}/${numbers.length} sent to ${phoneNumber}`);

        // Add delay between messages (except for the last one)
        if (i < numbers.length - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }

      } catch (error) {
        console.error(`Error sending to ${numbers[i]}:`, error.message);
        errors.push({
          number: numbers[i],
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      message: `Bulk message completed. ${results.length} sent, ${errors.length} failed.`,
      data: {
        sent: results,
        failed: errors,
        summary: {
          total: numbers.length,
          successful: results.length,
          failed: errors.length
        }
      }
    });

  } catch (error) {
    console.error(`Error in bulk message for token ${req.params.token}:`, error);
    res.status(500).json({ 
      error: 'Failed to process bulk message',
      details: error.message 
    });
  }
};

// Get session status
export const getSessionStatus = async (req, res) => {
  try {
    const { token } = req.params;

    // Validate token
    const session = await getSessionByToken(token);
    if (!session) {
      return res.status(404).json({ 
        error: 'Session not found' 
      });
    }

    const sessionInfo = getSessionInfo(token);
    const socket = getActiveSocket(token);

    res.json({
      success: true,
      data: {
        token: session.token,
        name: session.name,
        status: session.status,
        lastUpdate: session.updated_at,
        hasSocket: !!socket,
        isReady: sessionInfo.isReady,
        jid: sessionInfo.jid || null,
        userName: sessionInfo.name || null,
        sessionInfo: sessionInfo
      }
    });

  } catch (error) {
    console.error('Error getting session status:', error);
    res.status(500).json({ 
      error: 'Failed to get session status',
      details: error.message 
    });
  }
};

// Check if number exists on WhatsApp
export const checkNumberExists = async (req, res) => {
  try {
    const { token } = req.params;
    const { number } = req.body;

    // Validate input
    if (!number) {
      return res.status(400).json({ 
        error: 'Phone number is required' 
      });
    }

    // Validate token
    const session = await getSessionByToken(token);
    if (!session) {
      return res.status(404).json({ 
        error: 'Session not found' 
      });
    }

    // Get active socket
    const socket = getActiveSocket(token);
    if (!socket || !isSessionReady(token)) {
      return res.status(400).json({ 
        error: 'WhatsApp session not ready' 
      });
    }

    const phoneNumber = formatPhoneNumber(number);
    const cleanNumber = phoneNumber.replace('@s.whatsapp.net', '');
    
    try {
      // Check if number exists on WhatsApp
      const results = await socket.onWhatsApp(cleanNumber);
      const result = results && results.length > 0 ? results[0] : null;

      res.json({
        success: true,
        data: {
          number: number,
          formatted: phoneNumber,
          exists: result ? result.exists : false,
          jid: result ? result.jid : null
        }
      });
    } catch (checkError) {
      console.error('Error checking number:', checkError);
      // Fallback - assume number exists if we can't check
      res.json({
        success: true,
        data: {
          number: number,
          formatted: phoneNumber,
          exists: null, // Unknown
          jid: phoneNumber,
          note: 'Could not verify number existence, but formatted for sending'
        }
      });
    }

  } catch (error) {
    console.error(`Error checking number for token ${req.params.token}:`, error);
    res.status(500).json({ 
      error: 'Failed to check number',
      details: error.message 
    });
  }
};

// Utility function to format phone number
const formatPhoneNumber = (number) => {
  // Remove all non-numeric characters
  let cleaned = number.replace(/\D/g, '');
  
  // Handle Indonesian numbers
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.substring(1);
  } else if (!cleaned.startsWith('62')) {
    cleaned = '62' + cleaned;
  }
  
  // Add @s.whatsapp.net suffix
  return cleaned + '@s.whatsapp.net';
};

// Utility function to check if string is valid URL
const isValidUrl = (string) => {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
};

// Get user profile picture
export const getProfilePicture = async (req, res) => {
  try {
    const { token } = req.params;
    const { number } = req.query;

    if (!number) {
      return res.status(400).json({ 
        error: 'Phone number is required' 
      });
    }

    const session = await getSessionByToken(token);
    if (!session) {
      return res.status(404).json({ 
        error: 'Session not found' 
      });
    }

    const socket = getActiveSocket(token);
    if (!socket || !isSessionReady(token)) {
      return res.status(400).json({ 
        error: 'WhatsApp session not ready' 
      });
    }

    const phoneNumber = formatPhoneNumber(number);
    
    try {
      const profilePic = await socket.profilePictureUrl(phoneNumber, 'image');
      
      res.json({
        success: true,
        data: {
          number: number,
          profilePicture: profilePic
        }
      });
    } catch (error) {
      // Profile picture not found or privacy settings
      res.json({
        success: true,
        data: {
          number: number,
          profilePicture: null,
          message: 'Profile picture not available'
        }
      });
    }

  } catch (error) {
    console.error(`Error getting profile picture for token ${req.params.token}:`, error);
    res.status(500).json({ 
      error: 'Failed to get profile picture',
      details: error.message 
    });
  }
};