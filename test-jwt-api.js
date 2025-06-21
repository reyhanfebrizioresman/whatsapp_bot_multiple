import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001';

async function testJWTAPI() {
    console.log('=== Testing JWT API ===\n');

    try {
        // Step 1: Login
        console.log('1. Testing Login...');
        const loginResponse = await fetch(`${BASE_URL}/auth/api/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: 'admin',
                password: 'admin123'
            })
        });

        const loginData = await loginResponse.json();
        
        if (!loginData.success) {
            console.error('Login failed:', loginData.error);
            return;
        }

        console.log('✅ Login successful');
        console.log('Token:', loginData.data.token.substring(0, 50) + '...');
        console.log('User:', loginData.data.user.username);
        console.log('');

        const token = loginData.data.token;

        // Step 2: Test Connection
        console.log('2. Testing Connection...');
        const testResponse = await fetch(`${BASE_URL}/api/whatsapp/test/YOUR_SESSION_TOKEN`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const testData = await testResponse.json();
        console.log('Connection test result:', testData);
        console.log('');

        // Step 3: Get Session Status
        console.log('3. Testing Session Status...');
        const statusResponse = await fetch(`${BASE_URL}/api/whatsapp/status/YOUR_SESSION_TOKEN`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const statusData = await statusResponse.json();
        console.log('Session status:', statusData);
        console.log('');

        // Step 4: Send Message (if session is ready)
        if (statusData.success && statusData.data.isReady) {
            console.log('4. Testing Send Message...');
            const messageResponse = await fetch(`${BASE_URL}/api/whatsapp/send/YOUR_SESSION_TOKEN`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    number: '6281234567890',
                    message: 'Test pesan dari JWT API!',
                    type: 'text'
                })
            });

            const messageData = await messageResponse.json();
            console.log('Send message result:', messageData);
            console.log('');
        } else {
            console.log('⚠️  Session not ready, skipping message test');
            console.log('');
        }

        // Step 5: Refresh Token
        console.log('5. Testing Token Refresh...');
        const refreshResponse = await fetch(`${BASE_URL}/auth/api/refresh`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const refreshData = await refreshResponse.json();
        console.log('Token refresh result:', refreshData);
        console.log('');

        console.log('=== JWT API Test Complete ===');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    testJWTAPI();
}

export default testJWTAPI; 