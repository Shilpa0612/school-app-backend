// Create events for the teacher's actual assigned classes
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

async function createEventsForTeacherClasses() {
    console.log('🧪 Creating Events for Teacher\'s Assigned Classes');
    console.log('================================================');

    try {
        // Step 1: Login as admin/principal to create events
        console.log('1️⃣ Logging in as principal...');
        const login = await makeRequest('POST', '/auth/login', {
            phone_number: '1234567891', // Principal credentials
            password: 'password123'
        });

        if (login.status !== 200) {
            console.error('❌ Login failed:', login.data);
            return;
        }

        const token = login.data.data.token;
        console.log('✅ Logged in as:', login.data.data.user.full_name);

        // Step 2: Create events for each of the teacher's assigned classes
        const teacherClasses = [
            {
                id: 'c78f80f5-5a4a-428b-915d-fb076b7271b0',
                name: 'Grade 3 A',
                type: 'Sports Subject',
                event: {
                    title: 'Sports Practice - Grade 3 A',
                    description: 'Sports practice session for Grade 3 A students',
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
                name: 'Grade UKG A',
                type: 'Class Teacher',
                event: {
                    title: 'Class Activity - UKG A',
                    description: 'Special class activity for UKG A students',
                    event_date: '2024-12-20T10:00:00.000Z',
                    event_type: 'class_specific',
                    class_division_id: '8425282b-5dd9-45d9-b582-86b876c3abaf',
                    start_time: '10:00:00',
                    end_time: '11:00:00',
                    event_category: 'academic',
                    timezone: 'Asia/Kolkata'
                }
            },
            {
                id: '1bc6b23f-2c35-400a-825f-a5b90fa2f2f5',
                name: 'Grade NUR A',
                type: 'Class Teacher',
                event: {
                    title: 'Nursery Fun Day - NUR A',
                    description: 'Fun day activities for Nursery A students',
                    event_date: '2024-12-25T14:00:00.000Z',
                    event_type: 'class_specific',
                    class_division_id: '1bc6b23f-2c35-400a-825f-a5b90fa2f2f5',
                    start_time: '14:00:00',
                    end_time: '15:00:00',
                    event_category: 'cultural',
                    timezone: 'Asia/Kolkata'
                }
            }
        ];

        console.log('\n2️⃣ Creating events for teacher\'s assigned classes...');
        const createdEvents = [];

        for (const classInfo of teacherClasses) {
            console.log(`\n📝 Creating event for ${classInfo.name} (${classInfo.type})...`);
            console.log(`   Class ID: ${classInfo.id}`);

            const createEvent = await makeRequest('POST', '/calendar/events', classInfo.event, token);

            if (createEvent.status === 200 || createEvent.status === 201) {
                console.log(`✅ Event created: "${classInfo.event.title}"`);
                console.log(`   Event ID: ${createEvent.data.data?.id}`);
                console.log(`   Status: ${createEvent.data.data?.status}`);
                createdEvents.push(createEvent.data.data);
            } else {
                console.error(`❌ Failed to create event for ${classInfo.name}:`, createEvent.data);
            }
        }

        // Step 3: Test with teacher login to verify events appear
        console.log('\n3️⃣ Testing with teacher login...');
        const teacherLogin = await makeRequest('POST', '/auth/login', {
            phone_number: '9307915550',
            password: 'password123'
        });

        if (teacherLogin.status === 200) {
            const teacherToken = teacherLogin.data.data.token;
            console.log('✅ Teacher logged in:', teacherLogin.data.data.user.full_name);

            // Get teacher events
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

                    console.log('\n🎯 SUCCESS! Teacher can now see class-specific events for their assigned classes.');
                } else {
                    console.log('\n❌ Still no class-specific events visible to teacher.');
                    console.log('This suggests there might be another issue with the query logic.');
                }
            } else {
                console.error('❌ Failed to get teacher events:', teacherEvents.data);
            }
        } else {
            console.error('❌ Teacher login failed:', teacherLogin.data);
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

createEventsForTeacherClasses();

