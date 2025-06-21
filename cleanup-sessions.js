import { forceCloseAllSessions, getActiveSessions, getAllConnectionsStatus } from './services/whatsappService.js';

console.log('=== WhatsApp Session Cleanup Tool ===\n');

// Show current active sessions
console.log('Current active sessions:');
const activeSessions = getActiveSessions();
if (activeSessions.length === 0) {
    console.log('No active sessions found.');
} else {
    activeSessions.forEach(session => {
        console.log(`- ${session.sessionId}: ${session.status} (created: ${session.createdAt})`);
    });
}

console.log('\n=== Connection Status ===');
const connectionStatus = getAllConnectionsStatus();
Object.entries(connectionStatus).forEach(([sessionId, status]) => {
    console.log(`- ${sessionId}: ${status.status} (uptime: ${Math.round(status.uptime/1000)}s)`);
});

// Ask for confirmation
console.log('\nDo you want to force close all sessions? (y/N)');
process.stdin.once('data', (data) => {
    const input = data.toString().trim().toLowerCase();
    
    if (input === 'y' || input === 'yes') {
        console.log('\nForce closing all sessions...');
        const closedCount = forceCloseAllSessions();
        console.log(`Successfully closed ${closedCount} sessions.`);
    } else {
        console.log('Operation cancelled.');
    }
    
    process.exit(0);
}); 