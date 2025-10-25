// Simple test to login as teacher and check events
import https from 'https';

const BASE_URL = 'https://ajws-school-ba8ae5e3f955.herokuapp.com/api';

function makeRequest(method, path, data = null, token = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(BASE_URL + path);
        const options = {
            hostname: url.hostname,
            port: url.port || 443,
            path: url.pathname + url.search,
            method: method,
            headers: { 'Content-Type': 'application/json' }
        };
        if (token) options.headers['Authorization'] = `Bearer ${token}`;

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    resolve({ status: res.statusCode, data: parsed });
                } catch (e) {
                    resolve({ status: res.statusCode, data: body });
                }
            });
        });
        req.on('error', reject);
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

async function testTeacherLogin() {
    console.log('🔐 Testing Teacher Login and Events');
    console.log('==================================');

    try {
        // Try to login with the teacher's phone number
        console.log('📱 Attempting login with phone: 9307915550');
        const login = await makeRequest('POST', '/auth/login', {
            phone_number: '9307915550',
            password: 'password123'
        });

        if (login.status === 200) {
            console.log('✅ Login successful!');
            console.log('User:', login.data.data.user.full_name);
            console.log('Role:', login.data.data.user.role);
            console.log('ID:', login.data.data.user.id);

            const token = login.data.data.token;

            // Test events endpoint
            console.log('\n📅 Testing events endpoint...');
            const events = await makeRequest('GET', '/calendar/events/teacher?debug=true', null, token);

            if (events.status === 200) {
                console.log('✅ Events endpoint working!');
                console.log('Events found:', events.data.data?.events?.length || 0);
                console.log('Debug info:', JSON.stringify(events.data.data?.debug_info || events.data, null, 2));
            } else {
                console.log('❌ Events endpoint failed:', events.data);
            }

        } else {
            console.log('❌ Login failed:', login.data);
            console.log('\n💡 Try these alternative credentials:');
            console.log('   Phone: 9158834913, Password: Temp@1234');
            console.log('   Phone: 1234567893, Password: password123');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testTeacherLogin();
