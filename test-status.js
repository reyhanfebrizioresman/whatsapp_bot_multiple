import { getSessionInfo, getActiveSessions, getAllConnectionsStatus } from './services/whatsappService.js';

console.log('=== Testing Session Status ===\n');

// Test specific session
const testToken = 'a78a577d-b444-470f-9488-16e767e1fdec';

console.log(`Testing session: ${testToken}`);
const sessionInfo = getSessionInfo(testToken);
console.log('Session Info:', sessionInfo);

console.log('\n=== All Active Sessions ===');
const activeSessions = getActiveSessions();
activeSessions.forEach(session => {
    console.log(`- ${session.sessionId}: ${session.status} (ready: ${session.isReady})`);
});

console.log('\n=== Connection Status ===');
const connectionStatus = getAllConnectionsStatus();
Object.entries(connectionStatus).forEach(([sessionId, status]) => {
    console.log(`- ${sessionId}: ${status.status} (uptime: ${Math.round(status.uptime/1000)}s)`);
});

console.log('\n=== Test Complete ==='); 