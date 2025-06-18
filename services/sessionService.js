// Try this import method first
import baileys from '@whiskeysockets/baileys';
const { makeWASocket, useMultiFileAuthState, DisconnectReason } = baileys;

// Alternative import method if above doesn't work:
// import pkg from '@whiskeysockets/baileys';
// const { makeWASocket, useMultiFileAuthState, DisconnectReason } = pkg;

import { Boom } from '@hapi/boom';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Store active connections
const activeConnections = new Map();

// Get session info
export const getSessionInfo = (sessionId) => {
    const connection = activeConnections.get(sessionId);
    if (!connection) return {
        status: 'disconnected',
        qr: null,
        jid: null,
        name: null,
        isReady: false
    };

    return {
        status: connection.status,
        qr: connection.qr,
        jid: connection.sock?.user?.id,
        name: connection.sock?.user?.name,
        isReady: connection.status === 'connected'
    };
};

// Get active socket
export const getActiveSocket = (sessionId) => {
    const connection = activeConnections.get(sessionId);
    return connection?.sock || null;
};

// Check if session is ready
export const isSessionReady = (sessionId) => {
    const connection = activeConnections.get(sessionId);
    return connection?.status === 'connected';
};

// Start WhatsApp session
export const startWhatsAppSession = async (sessionId, qrCallback) => {
    try {
        console.log(`Initializing WhatsApp session for token: ${sessionId}`);
        
        // Debug: Check if makeWASocket is available
        if (typeof makeWASocket !== 'function') {
            console.error('makeWASocket type:', typeof makeWASocket);
            console.error('Available baileys exports:', Object.keys(baileys));
            throw new Error('makeWASocket is not a function. Check Baileys import.');
        }
        
        const sessionPath = path.join(__dirname, '../sessions', sessionId);
        
        // Create session directory if it doesn't exist
        if (!fs.existsSync(sessionPath)) {
            fs.mkdirSync(sessionPath, { recursive: true });
            console.log(`Created session directory: ${sessionPath}`);
        }

        // Load auth state
        console.log(`Loading auth state from: ${sessionPath}`);
        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

        // Create connection with enhanced configuration
        console.log('Creating WhatsApp socket...');
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false, // Changed to false since we handle QR via callback
            logger: {
                level: 'silent', // Reduce log noise
                log: () => {}
            },
            browser: ['Multi Session Bot', 'Chrome', '1.0.0'],
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 25000,
            generateHighQualityLinkPreview: false,
            syncFullHistory: false,
            markOnlineOnConnect: false
        });

        // Store connection info
        activeConnections.set(sessionId, {
            sock,
            status: 'connecting',
            qr: null,
            createdAt: new Date()
        });

        console.log(`Socket created for session: ${sessionId}`);

        // Handle connection updates
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            console.log(`Connection update for ${sessionId}:`, { connection, qr: !!qr });
            
            if (qr) {
                console.log(`QR code generated for session: ${sessionId}`);
                const connectionData = activeConnections.get(sessionId);
                if (connectionData) {
                    connectionData.qr = qr;
                    connectionData.status = 'qr_ready';
                }
                if (qrCallback) {
                    qrCallback(qr);
                }
            }

            if (connection === 'close') {
                console.log(`Connection closed for session: ${sessionId}`);
                const shouldReconnect = (lastDisconnect?.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
                
                console.log(`Should reconnect: ${shouldReconnect}`);
                
                if (shouldReconnect) {
                    console.log(`Attempting to reconnect session: ${sessionId}`);
                    // Add delay before reconnecting
                    setTimeout(() => {
                        startWhatsAppSession(sessionId, qrCallback);
                    }, 3000);
                } else {
                    console.log(`Session logged out, removing: ${sessionId}`);
                    activeConnections.delete(sessionId);
                }
            } else if (connection === 'open') {
                console.log(`Session connected successfully: ${sessionId}`);
                const connectionData = activeConnections.get(sessionId);
                if (connectionData) {
                    connectionData.status = 'connected';
                    connectionData.qr = null;
                }
            } else if (connection === 'connecting') {
                console.log(`Session connecting: ${sessionId}`);
                const connectionData = activeConnections.get(sessionId);
                if (connectionData) {
                    connectionData.status = 'connecting';
                }
            }
        });

        // Save credentials
        sock.ev.on('creds.update', async () => {
            console.log(`Credentials updated for session: ${sessionId}`);
            try {
                await saveCreds();
            } catch (error) {
                console.error(`Error saving credentials for ${sessionId}:`, error);
            }
        });

        // Handle messages (optional - for debugging)
        sock.ev.on('messages.upsert', (m) => {
            console.log(`Message received for session ${sessionId}:`, m.messages.length, 'messages');
        });

        return sock;
    } catch (error) {
        console.error(`Error starting WhatsApp session for ${sessionId}:`, error);
        
        // Clean up failed connection
        if (activeConnections.has(sessionId)) {
            activeConnections.delete(sessionId);
        }
        
        throw error;
    }
};

// Close socket connection
export const closeSocket = (sessionId) => {
    console.log(`Closing socket for session: ${sessionId}`);
    const connection = activeConnections.get(sessionId);
    if (connection?.sock) {
        try {
            connection.sock.end();
            console.log(`Socket closed for session: ${sessionId}`);
        } catch (error) {
            console.error(`Error closing socket for ${sessionId}:`, error);
        }
    }
    activeConnections.delete(sessionId);
};

// Get all active sessions (utility function)
export const getActiveSessions = () => {
    const sessions = [];
    for (const [sessionId, connection] of activeConnections.entries()) {
        sessions.push({
            sessionId,
            status: connection.status,
            hasQR: !!connection.qr,
            isReady: connection.status === 'connected',
            createdAt: connection.createdAt
        });
    }
    return sessions;
};

// Clean up inactive sessions (utility function)
export const cleanupInactiveSessions = () => {
    const now = new Date();
    const maxAge = 30 * 60 * 1000; // 30 minutes
    
    for (const [sessionId, connection] of activeConnections.entries()) {
        if (connection.status === 'connecting' && 
            now - connection.createdAt > maxAge) {
            console.log(`Cleaning up inactive session: ${sessionId}`);
            closeSocket(sessionId);
        }
    }
};