// Test script to check and create events for class 5A
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

async function testClass5AEvents() {
    console.log('🧪 Testing Class 5A Events');
    console.log('==========================');
    
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
        const teacherId = login.data.data.user.id;
        console.log('✅ Logged in as:', login.data.data.user.full_name);
        console.log('Teacher ID:', teacherId);
        
        // Step 2: Check what events exist for class 5A specifically
        const classDivisionId = '4f1c7d77-b748-4a3f-b86f-9b820829c35a';
        console.log('\n2️⃣ Checking events for class 5A...');
        console.log('Class Division ID:', classDivisionId);
        
        // Try to get events with specific class filter
        const classEvents = await makeRequest('GET', `/calendar/events/teacher?class_division_id=${classDivisionId}&debug=true`, null, token);
        
        if (classEvents.status === 200) {
            const events = classEvents.data.data?.events || [];
            console.log(`✅ Found ${events.length} events for class 5A`);
            
            if (events.length === 0) {
                console.log('❌ No events found for class 5A');
                console.log('\n3️⃣ Creating a test event for class 5A...');
                
                // Create a test event for class 5A
                const eventData = {
                    title: 'Mathematics Test - Class 5A',
                    description: 'Monthly mathematics test for class 5A students',
                    event_date: '2024-12-01T09:00:00.000Z',
                    event_type: 'class_specific',
                    class_division_id: classDivisionId,
                    start_time: '09:00:00',
                    end_time: '11:00:00',
                    event_category: 'exam',
                    timezone: 'Asia/Kolkata'
                };
                
                const createEvent = await makeRequest('POST', '/calendar/events', eventData, token);
                
                if (createEvent.status === 200 || createEvent.status === 201) {
                    console.log('✅ Test event created successfully!');
                    console.log('Event ID:', createEvent.data.data?.id);
                    console.log('Status:', createEvent.data.data?.status);
                    
                    // Now check if the event appears in teacher's events
                    console.log('\n4️⃣ Checking if new event appears in teacher events...');
                    const updatedEvents = await makeRequest('GET', '/calendar/events/teacher?debug=true', null, token);
                    
                    if (updatedEvents.status === 200) {
                        const allEvents = updatedEvents.data.data?.events || [];
                        const class5AEvents = allEvents.filter(event => 
                            event.class_division_id === classDivisionId || 
                            (event.class_division_ids && event.class_division_ids.includes(classDivisionId))
                        );
                        
                        console.log(`✅ Teacher can now see ${class5AEvents.length} events for class 5A`);
                        class5AEvents.forEach((event, i) => {
                            console.log(`\n${i + 1}. ${event.title}`);
                            console.log(`   Date: ${event.event_date}`);
                            console.log(`   Type: ${event.event_type}`);
                            console.log(`   Status: ${event.status}`);
                            console.log(`   Class: ${event.class_division_name}`);
                        });
                    }
                } else {
                    console.error('❌ Failed to create test event:', createEvent.data);
                }
            } else {
                console.log('📋 Existing events for class 5A:');
                events.forEach((event, i) => {
                    console.log(`\n${i + 1}. ${event.title}`);
                    console.log(`   Date: ${event.event_date}`);
                    console.log(`   Type: ${event.event_type}`);
                    console.log(`   Status: ${event.status}`);
                    console.log(`   Class: ${event.class_division_name}`);
                });
            }
        } else {
            console.error('❌ Failed to fetch class events:', classEvents.data);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testClass5AEvents();

