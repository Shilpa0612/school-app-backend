// Test script to login as teacher and fetch events with debug
import https from 'https';

const BASE_URL = 'https://ajws-school-ba8ae5e3f955.herokuapp.com/api';

// Helper function to make HTTP requests
function makeRequest(method, path, data = null, token = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(BASE_URL + path);

        const options = {
            hostname: url.hostname,
            port: url.port || 443,
            path: url.pathname + url.search,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }

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

        if (data) {
            req.write(JSON.stringify(data));
        }

        req.end();
    });
}

async function testTeacherEvents() {
    console.log('🧪 Testing Teacher Events with Debug Information');
    console.log('================================================');
    console.log('');

    try {
        // Step 1: Login as Teacher (using the phone number from the teacher data)
        console.log('1️⃣ Logging in as Teacher...');
        const teacherLogin = await makeRequest('POST', '/auth/login', {
            phone_number: '9307915550', // From the teacher data provided
            password: 'password123' // Default password
        });

        if (teacherLogin.status !== 200) {
            console.error('❌ Teacher login failed:', teacherLogin.data);
            console.log('💡 Trying alternative login credentials...');

            // Try with alternative credentials from test files
            const altLogin = await makeRequest('POST', '/auth/login', {
                phone_number: '9158834913',
                password: 'Temp@1234'
            });

            if (altLogin.status !== 200) {
                console.error('❌ Alternative login also failed:', altLogin.data);
                return;
            }

            console.log('✅ Teacher logged in with alternative credentials:', altLogin.data.data.user.full_name);
            const teacherToken = altLogin.data.data.token;
            const teacherId = altLogin.data.data.user.id;

            // Test with this teacher
            await testTeacherEventsWithToken(teacherToken, teacherId);
            return;
        }

        const teacherToken = teacherLogin.data.data.token;
        const teacherId = teacherLogin.data.data.user.id;
        console.log('✅ Teacher logged in:', teacherLogin.data.data.user.full_name);
        console.log('Teacher ID:', teacherId);
        console.log('Token:', teacherToken.substring(0, 20) + '...');

        await testTeacherEventsWithToken(teacherToken, teacherId);

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

async function testTeacherEventsWithToken(teacherToken, teacherId) {
    try {
        // Step 2: Fetch teacher events with debug enabled
        console.log('\n2️⃣ Fetching teacher events with debug...');
        const eventsResponse = await makeRequest('GET', '/calendar/events/teacher?debug=true&start_date=2024-01-01&end_date=2024-12-31', null, teacherToken);

        if (eventsResponse.status !== 200) {
            console.error('❌ Failed to fetch teacher events:', eventsResponse.data);
            return;
        }

        console.log('✅ Teacher events fetched successfully!');
        console.log('\n📊 DEBUG INFORMATION:');
        console.log('====================');

        const debugInfo = eventsResponse.data.data?.debug_info || eventsResponse.data;
        console.log(JSON.stringify(debugInfo, null, 2));

        // Step 3: Show events summary
        const events = eventsResponse.data.data?.events || [];
        console.log(`\n📅 EVENTS SUMMARY:`);
        console.log(`=================`);
        console.log(`Total events found: ${events.length}`);

        if (events.length > 0) {
            console.log('\n📋 Events:');
            events.forEach((event, i) => {
                console.log(`\n${i + 1}. ${event.title}`);
                console.log(`   Date: ${event.event_date}`);
                console.log(`   Type: ${event.event_type}`);
                console.log(`   Status: ${event.status}`);
                console.log(`   Class: ${event.class_division_name || 'N/A'}`);
                console.log(`   Category: ${event.event_category}`);
            });
        } else {
            console.log('\n❌ No events found for this teacher');
            console.log('\n🔍 DEBUGGING STEPS:');
            console.log('1. Check if teacher has class assignments in class_teacher_assignments table');
            console.log('2. Verify the class_division_id for class 5A exists');
            console.log('3. Ensure teacher assignment has is_active = true');
            console.log('4. Check if events exist for the assigned classes');
        }

        // Step 4: Test creating an event for class 5A
        console.log('\n3️⃣ Testing event creation for class 5A...');

        // First, let's try to find the class division ID for 5A
        console.log('💡 To create an event for class 5A, we need the class_division_id');
        console.log('   You can find this by querying the class_divisions table');
        console.log('   or by checking the teacher assignments debug info above');

    } catch (error) {
        console.error('❌ Error in testTeacherEventsWithToken:', error.message);
    }
}

// Run the test
testTeacherEvents();
