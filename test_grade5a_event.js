// Test script to create an event for Grade 5 A and verify it appears
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

async function testGrade5AEvent() {
    console.log('🧪 Testing Grade 5 A Event Creation and Visibility');
    console.log('==================================================');

    try {
        // Step 1: Login as principal to create event
        console.log('1️⃣ Logging in as principal...');
        const login = await makeRequest('POST', '/auth/login', {
            phone_number: '1234567891',
            password: 'password123'
        });

        if (login.status !== 200) {
            console.error('❌ Login failed:', login.data);
            return;
        }

        const token = login.data.data.token;
        console.log('✅ Logged in as:', login.data.data.user.full_name);

        // Step 2: Create event for Grade 5 A
        const grade5AClassId = '4f1c7d77-b748-4a3f-b86f-9b820829c35a';
        console.log('\n2️⃣ Creating event for Grade 5 A...');
        console.log('Class Division ID:', grade5AClassId);

        const eventData = {
            title: 'Grade 5 A Mathematics Test',
            description: 'Monthly mathematics test for Grade 5 A students',
            event_date: '2024-12-15T09:00:00.000Z',
            event_type: 'class_specific',
            class_division_id: grade5AClassId,
            start_time: '09:00:00',
            end_time: '11:00:00',
            event_category: 'exam',
            timezone: 'Asia/Kolkata'
        };

        const createEvent = await makeRequest('POST', '/calendar/events', eventData, token);

        if (createEvent.status === 200 || createEvent.status === 201) {
            console.log('✅ Event created successfully!');
            console.log('Event ID:', createEvent.data.data?.id);
            console.log('Status:', createEvent.data.data?.status);
            console.log('Class Division ID:', createEvent.data.data?.class_division_id);
            console.log('Event Type:', createEvent.data.data?.event_type);
        } else {
            console.error('❌ Failed to create event:', createEvent.data);
            return;
        }

        // Step 3: Test with teacher login
        console.log('\n3️⃣ Testing with teacher login...');
        const teacherLogin = await makeRequest('POST', '/auth/login', {
            phone_number: '9307915550',
            password: 'password123'
        });

        if (teacherLogin.status !== 200) {
            console.error('❌ Teacher login failed:', teacherLogin.data);
            return;
        }

        const teacherToken = teacherLogin.data.data.token;
        console.log('✅ Teacher logged in:', teacherLogin.data.data.user.full_name);

        // Step 4: Get teacher events with debug
        console.log('\n4️⃣ Getting teacher events with debug...');
        const teacherEvents = await makeRequest('GET', '/calendar/events/teacher?debug=true', null, teacherToken);

        if (teacherEvents.status === 200) {
            const allEvents = teacherEvents.data.data?.events || [];
            const classSpecificEvents = allEvents.filter(event => event.event_type === 'class_specific');

            console.log(`\n📊 RESULTS:`);
            console.log(`===========`);
            console.log(`✅ Teacher can see ${allEvents.length} total events`);
            console.log(`✅ Teacher can see ${classSpecificEvents.length} class-specific events`);

            if (classSpecificEvents.length > 0) {
                console.log('\n📋 Class-specific events visible to teacher:');
                classSpecificEvents.forEach((event, i) => {
                    console.log(`\n${i + 1}. ${event.title}`);
                    console.log(`   Date: ${event.event_date}`);
                    console.log(`   Type: ${event.event_type}`);
                    console.log(`   Status: ${event.status}`);
                    console.log(`   Class: ${event.class_division_name}`);
                    console.log(`   Class ID: ${event.class_division_id}`);
                });

                console.log('\n🎯 SUCCESS! Teacher can now see class-specific events for Grade 5 A.');
            } else {
                console.log('\n❌ Still no class-specific events visible to teacher.');
                console.log('This suggests there might be an issue with the query logic or event creation.');
            }

            // Show debug info
            const debugInfo = teacherEvents.data.data?.debug_info || teacherEvents.data;
            console.log('\n🔍 Debug Info:');
            console.log(JSON.stringify(debugInfo, null, 2));

        } else {
            console.error('❌ Failed to get teacher events:', teacherEvents.data);
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testGrade5AEvent();
