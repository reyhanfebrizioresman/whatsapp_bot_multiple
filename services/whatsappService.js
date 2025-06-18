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
                const shouldReconnect = (lastDisconnect?.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
                
                console.log(`Should reconnect: ${shouldReconnect}`);
                
                if (shouldReconnect) {
                    console.log(`Attempting to reconnect session: ${sessionId}`);
                    // Update database status to connecting
                    if (updateSessionStatus) {
                        try {
                            await updateSessionStatus(sessionId, 'connecting');
                        } catch (error) {
                            console.error(`Error updating session status to connecting for ${sessionId}:`, error);
                        }
                    }
                    // Add delay before reconnecting
                    setTimeout(() => {
                        startWhatsAppSession(sessionId, qrCallback);
                    }, 3000);
                } else {
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
                }
            } else if (connection === 'open') {
                console.log(`Session connected successfully: ${sessionId}`);
                const connectionData = activeConnections.get(sessionId);
                if (connectionData) {
                    connectionData.status = 'connected';
                    connectionData.qr = null;
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
