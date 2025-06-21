import baileys from '@whiskeysockets/baileys';
const { makeWASocket, useMultiFileAuthState, DisconnectReason } = baileys;

import { Boom } from '@hapi/boom';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pino from 'pino';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SESSION_DIR = path.join(__dirname, '../sessions');
const activeConnections = new Map();

const logger = pino({ level: 'silent' });

// Import database functions
let updateSessionStatus;
import('../models/sessionModel.js').then(module => {
    updateSessionStatus = module.updateSessionStatus;
}).catch(err => {
    console.error('Failed to import sessionModel:', err);
});

function getSessionPath(sessionId) {
    return path.join(SESSION_DIR, sessionId);
}

function updateConnectionStatus(sessionId, updates = {}) {
    const conn = activeConnections.get(sessionId);
    if (conn) {
        Object.assign(conn, updates);
    }
}

export const getSessionInfo = (sessionId) => {
    const conn = activeConnections.get(sessionId);
    return {
        status: conn?.status || 'disconnected',
        qr: conn?.qr || null,
        jid: conn?.sock?.user?.id || null,
        name: conn?.sock?.user?.name || null,
        isReady: conn?.status === 'connected'
    };
};

export const getActiveSocket = (sessionId) => {
    return activeConnections.get(sessionId)?.sock || null;
};

export const isSessionReady = (sessionId) => {
    return activeConnections.get(sessionId)?.status === 'connected';
};

export const startWhatsAppSession = async (sessionId, qrCallback) => {
    try {
        console.log(`Initializing WhatsApp session for token: ${sessionId}`);
        
        // Check if session already exists and is connected
        const existingConn = activeConnections.get(sessionId);
        if (existingConn && existingConn.status === 'connected') {
            console.log(`Session ${sessionId} already connected, returning existing socket`);
            return existingConn.sock;
        }
        
        // Debug: Check if makeWASocket is available
        if (typeof makeWASocket !== 'function') {
            console.error('makeWASocket type:', typeof makeWASocket);
            console.error('Available baileys exports:', Object.keys(baileys));
            throw new Error('makeWASocket is not a function. Check Baileys import.');
        }
        
        const sessionPath = getSessionPath(sessionId);
        
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
            logger: logger, // Pakai pino instance
            browser: ['Multi Session Bot', 'Chrome', '1.0.0'],
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 25000,
            generateHighQualityLinkPreview: false,
            syncFullHistory: false,
            markOnlineOnConnect: false,
            retryRequestDelayMs: 2000,
            maxRetries: 3
        });

        // Store connection info
        activeConnections.set(sessionId, {
            sock,
            status: 'connecting',
            qr: null,
            createdAt: new Date(),
            reconnectAttempts: 0,
            maxReconnectAttempts: 3
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
                    connectionData.reconnectAttempts = 0; // Reset reconnect attempts when QR is generated
                }
                // Update database status
                if (updateSessionStatus) {
                    try {
                        await updateSessionStatus(sessionId, 'qr_ready');
                    } catch (error) {
                        console.error(`Error updating session status to qr_ready for ${sessionId}:`, error);
                    }
                }
                if (qrCallback) {
                    qrCallback(qr);
                }
            }

            if (connection === 'close') {
                console.log(`Connection closed for session: ${sessionId}`);
                const connectionData = activeConnections.get(sessionId);
                
                // Check disconnect reason
                const disconnectReason = lastDisconnect?.error?.output?.statusCode;
                const isLoggedOut = disconnectReason === DisconnectReason.loggedOut;
                const isConnectionClosed = disconnectReason === DisconnectReason.connectionClosed;
                const isConnectionLost = disconnectReason === DisconnectReason.connectionLost;
                
                console.log(`Disconnect reason: ${disconnectReason}`);
                console.log(`Is logged out: ${isLoggedOut}`);
                console.log(`Is connection closed: ${isConnectionClosed}`);
                console.log(`Is connection lost: ${isConnectionLost}`);
                
                if (isLoggedOut) {
                    console.log(`Session logged out, removing: ${sessionId}`);
                    // Update database status to disconnected
                    if (updateSessionStatus) {
                        try {
                            await updateSessionStatus(sessionId, 'disconnected');
                        } catch (error) {
                            console.error(`Error updating session status to disconnected for ${sessionId}:`, error);
                        }
                    }
                    activeConnections.delete(sessionId);
                    return;
                }
                
                // Only reconnect for connection lost or closed, not for logged out
                const shouldReconnect = (isConnectionLost || isConnectionClosed) && 
                                      connectionData && 
                                      connectionData.reconnectAttempts < connectionData.maxReconnectAttempts;
                
                console.log(`Should reconnect: ${shouldReconnect}`);
                console.log(`Reconnect attempts: ${connectionData?.reconnectAttempts || 0}`);
                
                if (shouldReconnect) {
                    connectionData.reconnectAttempts++;
                    console.log(`Attempting to reconnect session: ${sessionId} (attempt ${connectionData.reconnectAttempts})`);
                    
                    // Update database status to connecting
                    if (updateSessionStatus) {
                        try {
                            await updateSessionStatus(sessionId, 'connecting');
                        } catch (error) {
                            console.error(`Error updating session status to connecting for ${sessionId}:`, error);
                        }
                    }
                    
                    // Add exponential backoff delay before reconnecting
                    const delay = Math.min(3000 * Math.pow(2, connectionData.reconnectAttempts - 1), 30000);
                    console.log(`Reconnecting in ${delay}ms`);
                    
                    setTimeout(() => {
                        // Check if session still exists before reconnecting
                        if (activeConnections.has(sessionId)) {
                            startWhatsAppSession(sessionId, qrCallback);
                        }
                    }, delay);
                } else {
                    console.log(`Max reconnect attempts reached or session logged out, removing: ${sessionId}`);
                    // Update database status to disconnected
                    if (updateSessionStatus) {
                        try {
                            await updateSessionStatus(sessionId, 'disconnected');
                        } catch (error) {
                            console.error(`Error updating session status to disconnected for ${sessionId}:`, error);
                        }
                    }
                    activeConnections.delete(sessionId);
                }
            } else if (connection === 'open') {
                console.log(`Session connected successfully: ${sessionId}`);
                const connectionData = activeConnections.get(sessionId);
                if (connectionData) {
                    connectionData.status = 'connected';
                    connectionData.qr = null;
                    connectionData.reconnectAttempts = 0; // Reset reconnect attempts on successful connection
                }
                // Update database status to connected
                if (updateSessionStatus) {
                    try {
                        await updateSessionStatus(sessionId, 'connected');
                    } catch (error) {
                        console.error(`Error updating session status to connected for ${sessionId}:`, error);
                    }
                }
            } else if (connection === 'connecting') {
                console.log(`Session connecting: ${sessionId}`);
                const connectionData = activeConnections.get(sessionId);
                if (connectionData) {
                    connectionData.status = 'connecting';
                }
                // Update database status to connecting
                if (updateSessionStatus) {
                    try {
                        await updateSessionStatus(sessionId, 'connecting');
                    } catch (error) {
                        console.error(`Error updating session status to connecting for ${sessionId}:`, error);
                    }
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

export const closeSocket = (sessionId) => {
    const conn = activeConnections.get(sessionId);
    if (conn?.sock) {
        try {
            conn.sock.end();
            console.log(`Socket for ${sessionId} closed.`);
        } catch (err) {
            console.error(`Error closing socket ${sessionId}`, err);
        }
    }
    activeConnections.delete(sessionId);
};

export const getActiveSessions = () => {
    return Array.from(activeConnections.entries()).map(([sessionId, conn]) => ({
        sessionId,
        status: conn.status,
        hasQR: !!conn.qr,
        isReady: conn.status === 'connected',
        createdAt: conn.createdAt
    }));
};

export const getAllConnectionsStatus = () => {
    const result = {};
    const now = Date.now();
    activeConnections.forEach((conn, id) => {
        result[id] = {
            status: conn.status,
            hasQR: !!conn.qr,
            isReady: conn.status === 'connected',
            createdAt: conn.createdAt,
            uptime: now - conn.createdAt
        };
    });
    return result;
};

export const getConnectionCount = () => {
    let connected = 0, connecting = 0, qrReady = 0;
    for (const conn of activeConnections.values()) {
        if (conn.status === 'connected') connected++;
        else if (conn.status === 'connecting') connecting++;
        else if (conn.status === 'qr_ready') qrReady++;
    }
    return {
        total: activeConnections.size,
        connected,
        connecting,
        qrReady
    };
};

export const cleanupInactiveSessions = () => {
    const now = Date.now();
    const maxAge = 30 * 60 * 1000;
    for (const [id, conn] of activeConnections.entries()) {
        if (conn.status === 'connecting' && now - conn.createdAt > maxAge) {
            console.log(`Cleaning up inactive session: ${id}`);
            closeSocket(id);
        }
    }
};

export const forceCloseAllSessions = () => {
    const sessionIds = Array.from(activeConnections.keys());
    sessionIds.forEach(closeSocket);
    console.log(`Force closed ${sessionIds.length} sessions.`);
    return sessionIds.length;
};

export const forceCleanupSession = (sessionId) => {
    console.log(`Force cleaning up session: ${sessionId}`);
    const conn = activeConnections.get(sessionId);
    if (conn?.sock) {
        try {
            conn.sock.end();
            console.log(`Force closed socket for ${sessionId}`);
        } catch (err) {
            console.error(`Error force closing socket ${sessionId}`, err);
        }
    }
    activeConnections.delete(sessionId);
    
    // Update database status
    if (updateSessionStatus) {
        updateSessionStatus(sessionId, 'disconnected').catch(console.error);
    }
    
    return true;
};

export const resetSessionReconnectAttempts = (sessionId) => {
    const conn = activeConnections.get(sessionId);
    if (conn) {
        conn.reconnectAttempts = 0;
        console.log(`Reset reconnect attempts for session: ${sessionId}`);
        return true;
    }
    return false;
};

// Automatic cleanup function
export const startAutomaticCleanup = () => {
    console.log('Starting automatic cleanup service...');
    
    // Run cleanup every 5 minutes
    setInterval(() => {
        console.log('Running automatic cleanup...');
        const now = Date.now();
        const maxAge = 10 * 60 * 1000; // 10 minutes
        const maxReconnectAge = 5 * 60 * 1000; // 5 minutes
        
        for (const [sessionId, conn] of activeConnections.entries()) {
            const sessionAge = now - conn.createdAt;
            
            // Clean up sessions that have been connecting for too long
            if (conn.status === 'connecting' && sessionAge > maxAge) {
                console.log(`Auto-cleanup: Removing long-connecting session ${sessionId} (age: ${Math.round(sessionAge/1000)}s)`);
                forceCleanupSession(sessionId);
                continue;
            }
            
            // Clean up sessions with too many reconnect attempts
            if (conn.reconnectAttempts >= conn.maxReconnectAttempts) {
                console.log(`Auto-cleanup: Removing session ${sessionId} with max reconnect attempts`);
                forceCleanupSession(sessionId);
                continue;
            }
            
            // Clean up sessions that have been in qr_ready for too long
            if (conn.status === 'qr_ready' && sessionAge > maxReconnectAge) {
                console.log(`Auto-cleanup: Removing old QR session ${sessionId} (age: ${Math.round(sessionAge/1000)}s)`);
                forceCleanupSession(sessionId);
                continue;
            }
        }
        
        console.log(`Automatic cleanup completed. Active sessions: ${activeConnections.size}`);
    }, 5 * 60 * 1000); // 5 minutes
};
