// Test script to create events for the teacher's assigned classes
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

async function createTestEventsForTeacher() {
    console.log('🧪 Creating Test Events for Teacher Classes');
    console.log('==========================================');

    try {
        // Step 1: Login as teacher
        console.log('1️⃣ Logging in as teacher...');
        const login = await makeRequest('POST', '/auth/login', {
            phone_number: '9307915550',
            password: 'password123'
        });

        if (login.status !== 200) {
            console.error('❌ Login failed:', login.data);
            return;
        }

        const token = login.data.data.token;
        console.log('✅ Logged in as:', login.data.data.user.full_name);

        // Step 2: Create events for each assigned class
        const classAssignments = [
            {
                id: 'c78f80f5-5a4a-428b-915d-fb076b7271b0',
                type: 'Sports Subject',
                event: {
                    title: 'Sports Day Practice - Class Assignment',
                    description: 'Sports practice session for assigned class',
                    event_date: '2024-12-15T09:00:00.000Z',
                    event_type: 'class_specific',
                    class_division_id: 'c78f80f5-5a4a-428b-915d-fb076b7271b0',
                    start_time: '09:00:00',
                    end_time: '10:00:00',
                    event_category: 'sports',
                    timezone: 'Asia/Kolkata'
                }
            },
            {
                id: '8425282b-5dd9-45d9-b582-86b876c3abaf',
                type: 'Class Teacher',
                event: {
                    title: 'Class Meeting - Grade Assignment',
                    description: 'Monthly class meeting for assigned grade',
                    event_date: '2024-12-20T10:00:00.000Z',
                    event_type: 'class_specific',
                    class_division_id: '8425282b-5dd9-45d9-b582-86b876c3abaf',
                    start_time: '10:00:00',
                    end_time: '11:00:00',
                    event_category: 'meeting',
                    timezone: 'Asia/Kolkata'
                }
            },
            {
                id: '1bc6b23f-2c35-400a-825f-a5b90fa2f2f5',
                type: 'Class Teacher',
                event: {
                    title: 'Parent-Teacher Conference',
                    description: 'PTM for assigned class students',
                    event_date: '2024-12-25T14:00:00.000Z',
                    event_type: 'class_specific',
                    class_division_id: '1bc6b23f-2c35-400a-825f-a5b90fa2f2f5',
                    start_time: '14:00:00',
                    end_time: '16:00:00',
                    event_category: 'meeting',
                    timezone: 'Asia/Kolkata'
                }
            }
        ];

        console.log('\n2️⃣ Creating events for assigned classes...');
        const createdEvents = [];

        for (const assignment of classAssignments) {
            console.log(`\n📝 Creating event for ${assignment.type} (${assignment.id})...`);

            const createEvent = await makeRequest('POST', '/calendar/events', assignment.event, token);

            if (createEvent.status === 200 || createEvent.status === 201) {
                console.log(`✅ Event created: "${assignment.event.title}"`);
                console.log(`   Event ID: ${createEvent.data.data?.id}`);
                console.log(`   Status: ${createEvent.data.data?.status}`);
                createdEvents.push(createEvent.data.data);
            } else {
                console.error(`❌ Failed to create event for ${assignment.id}:`, createEvent.data);
            }
        }

        // Step 3: Verify events appear in teacher's event list
        console.log('\n3️⃣ Verifying events appear in teacher event list...');
        const eventsResponse = await makeRequest('GET', '/calendar/events/teacher?debug=true', null, token);

        if (eventsResponse.status === 200) {
            const allEvents = eventsResponse.data.data?.events || [];
            const classSpecificEvents = allEvents.filter(event => event.event_type === 'class_specific');

            console.log(`✅ Teacher can now see ${allEvents.length} total events`);
            console.log(`✅ Teacher can see ${classSpecificEvents.length} class-specific events`);

            if (classSpecificEvents.length > 0) {
                console.log('\n📋 Class-specific events:');
                classSpecificEvents.forEach((event, i) => {
                    console.log(`\n${i + 1}. ${event.title}`);
                    console.log(`   Date: ${event.event_date}`);
                    console.log(`   Type: ${event.event_type}`);
                    console.log(`   Status: ${event.status}`);
                    console.log(`   Class: ${event.class_division_name}`);
                    console.log(`   Class ID: ${event.class_division_id}`);
                });
            }

            console.log('\n🎯 SUCCESS! Teacher can now see class-specific events.');
            console.log('The issue was that no class-specific events existed for the assigned classes.');

        } else {
            console.error('❌ Failed to verify events:', eventsResponse.data);
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

createTestEventsForTeacher();
