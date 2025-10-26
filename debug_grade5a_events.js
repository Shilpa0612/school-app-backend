// Debug script to check what events exist for Grade 5 A
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

async function debugGrade5AEvents() {
    console.log('🔍 Debugging Grade 5 A Events');
    console.log('==============================');

    try {
        // Step 1: Login as principal to get all events
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

        // Step 2: Get all events to see what exists
        console.log('\n2️⃣ Getting all events...');
        const allEvents = await makeRequest('GET', '/calendar/events', null, token);

        if (allEvents.status === 200) {
            const events = allEvents.data.data?.events || [];
            console.log(`✅ Found ${events.length} total events`);

            // Step 3: Filter events for Grade 5 A
            const grade5AClassId = '4f1c7d77-b748-4a3f-b86f-9b820829c35a';
            console.log(`\n3️⃣ Looking for events for Grade 5 A (${grade5AClassId})...`);

            const grade5AEvents = events.filter(event => {
                // Check single class events
                if (event.class_division_id === grade5AClassId) {
                    return true;
                }
                // Check multi-class events
                if (event.class_division_ids && Array.isArray(event.class_division_ids)) {
                    return event.class_division_ids.includes(grade5AClassId);
                }
                if (event.class_divisions && Array.isArray(event.class_divisions)) {
                    return event.class_divisions.includes(grade5AClassId);
                }
                return false;
            });

            console.log(`✅ Found ${grade5AEvents.length} events for Grade 5 A`);

            if (grade5AEvents.length > 0) {
                console.log('\n📋 Grade 5 A Events:');
                grade5AEvents.forEach((event, i) => {
                    console.log(`\n${i + 1}. ${event.title}`);
                    console.log(`   ID: ${event.id}`);
                    console.log(`   Date: ${event.event_date}`);
                    console.log(`   Type: ${event.event_type}`);
                    console.log(`   Status: ${event.status}`);
                    console.log(`   Class Division ID: ${event.class_division_id}`);
                    console.log(`   Class Division IDs: ${JSON.stringify(event.class_division_ids)}`);
                    console.log(`   Class Divisions: ${JSON.stringify(event.class_divisions)}`);
                });

                console.log('\n🎯 These events SHOULD be visible to the teacher!');
                console.log('If they are not showing up, there is a query issue.');
            } else {
                console.log('\n❌ No events found for Grade 5 A');
                console.log('This explains why the teacher cannot see any class-specific events.');
            }

            // Step 4: Show all class-specific events
            console.log('\n4️⃣ All class-specific events:');
            const classSpecificEvents = events.filter(event => event.event_type === 'class_specific');
            console.log(`Found ${classSpecificEvents.length} class-specific events:`);

            classSpecificEvents.forEach((event, i) => {
                console.log(`\n${i + 1}. ${event.title}`);
                console.log(`   Class Division ID: ${event.class_division_id}`);
                console.log(`   Class Division IDs: ${JSON.stringify(event.class_division_ids)}`);
                console.log(`   Class Divisions: ${JSON.stringify(event.class_divisions)}`);
            });

        } else {
            console.error('❌ Failed to get events:', allEvents.data);
        }

    } catch (error) {
        console.error('❌ Debug failed:', error.message);
    }
}

debugGrade5AEvents();
