const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3000';

// Test authentication first
async function testAuth() {
    try {
        console.log('🔐 Testing authentication...');
        const response = await fetch(`${BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: 'admin@school.com',
                password: 'password123'
            })
        });

        const data = await response.json();
        console.log('Auth response status:', response.status);

        if (data.token) {
            return data.token;
        } else {
            console.error('❌ Authentication failed');
            return null;
        }
    } catch (error) {
        console.error('❌ Auth error:', error.message);
        return null;
    }
}

// Test the new timetable system
async function testNewTimetable(token) {
    if (!token) {
        console.log('❌ No token available, skipping tests');
        return;
    }

    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

    console.log('\n📚 Testing New Simplified Timetable System...\n');

    // Test 1: Create timetable configuration
    try {
        console.log('1. Creating timetable configuration...');
        const configData = {
            name: 'Primary School Schedule 2025-26',
            description: 'Standard timetable for primary school classes',
            academic_year_id: 'your-academic-year-id-here', // You'll need to replace this
            total_periods: 8,
            days_per_week: 6
        };

        const response1 = await fetch(`${BASE_URL}/api/timetable/config`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(configData)
        });

        console.log('   Response status:', response1.status);
        const data1 = await response1.json();

        if (response1.ok) {
            console.log('   ✅ Timetable configuration created successfully');
            console.log('   📊 Config ID:', data1.data.config.id);
            console.log('   📊 Total periods:', data1.data.config.total_periods);
            console.log('   📊 Days per week:', data1.data.config.days_per_week);

            const configId = data1.data.config.id;

            // Test 2: Create class timetable entries
            console.log('\n2. Creating class timetable entries...');
            const entriesData = {
                config_id: configId,
                class_division_id: 'your-class-division-id-here', // You'll need to replace this
                entries: [
                    {
                        period_number: 1,
                        day_of_week: 1, // Monday
                        subject: 'English',
                        teacher_id: 'your-teacher-id-here' // You'll need to replace this
                    },
                    {
                        period_number: 2,
                        day_of_week: 1, // Monday
                        subject: 'Kannada',
                        teacher_id: 'your-teacher-id-here' // You'll need to replace this
                    },
                    {
                        period_number: 3,
                        day_of_week: 1, // Monday
                        subject: 'Mathematics',
                        teacher_id: 'your-teacher-id-here' // You'll need to replace this
                    },
                    {
                        period_number: 1,
                        day_of_week: 2, // Tuesday
                        subject: 'English',
                        teacher_id: 'your-teacher-id-here' // You'll need to replace this
                    },
                    {
                        period_number: 2,
                        day_of_week: 2, // Tuesday
                        subject: 'Kannada',
                        teacher_id: 'your-teacher-id-here' // You'll need to replace this
                    }
                ]
            };

            const response2 = await fetch(`${BASE_URL}/api/timetable/bulk-entries`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(entriesData)
            });

            console.log('   Response status:', response2.status);
            const data2 = await response2.json();

            if (response2.ok) {
                console.log('   ✅ Timetable entries created successfully');
                console.log('   📊 Total entries created:', data2.data.entries.length);

                // Test 3: Get class timetable
                console.log('\n3. Fetching class timetable...');
                const classDivisionId = entriesData.class_division_id;

                const response3 = await fetch(`${BASE_URL}/api/timetable/class/${classDivisionId}?config_id=${configId}`, {
                    method: 'GET',
                    headers: headers
                });

                console.log('   Response status:', response3.status);
                const data3 = await response3.json();

                if (response3.ok) {
                    console.log('   ✅ Class timetable fetched successfully');
                    console.log('   📊 Total entries:', data3.data.total_entries);
                    console.log('   📊 Days with entries:', Object.keys(data3.data.timetable).length);

                    // Show sample timetable structure
                    console.log('\n   📅 Sample Timetable Structure:');
                    Object.keys(data3.data.timetable).forEach(day => {
                        console.log(`     ${day}:`);
                        data3.data.timetable[day].forEach(entry => {
                            console.log(`       Period ${entry.period_number}: ${entry.subject || 'Break'}`);
                        });
                    });
                } else {
                    console.log('   ❌ Failed to fetch class timetable');
                    console.log('   Response:', data3);
                }
            } else {
                console.log('   ❌ Failed to create timetable entries');
                console.log('   Response:', data2);
            }
        } else {
            console.log('   ❌ Failed to create timetable configuration');
            console.log('   Response:', data1);
        }

    } catch (error) {
        console.error('   ❌ Error testing timetable system:', error.message);
    }

    // Test 4: Get timetable configurations
    try {
        console.log('\n4. Fetching timetable configurations...');
        const response4 = await fetch(`${BASE_URL}/api/timetable/config`, {
            method: 'GET',
            headers: headers
        });

        console.log('   Response status:', response4.status);
        const data4 = await response4.json();

        if (response4.ok) {
            console.log('   ✅ Timetable configurations fetched successfully');
            console.log('   📊 Total configs:', data4.data.configs.length);

            if (data4.data.configs.length > 0) {
                console.log('   📋 Available configurations:');
                data4.data.configs.forEach((config, index) => {
                    console.log(`     ${index + 1}. ${config.name} (${config.total_periods} periods, ${config.days_per_week} days)`);
                });
            }
        } else {
            console.log('   ❌ Failed to fetch configurations');
            console.log('   Response:', data4);
        }

    } catch (error) {
        console.error('   ❌ Error fetching configurations:', error.message);
    }
}

// Main test function
async function runTests() {
    console.log('🚀 Starting New Timetable System Tests...\n');

    const token = await testAuth();
    await testNewTimetable(token);

    console.log('\n✅ Tests completed');
    console.log('\n💡 What this new system provides:');
    console.log('   1. ✅ Simple timetable configuration (periods, days)');
    console.log('   2. ✅ Direct subject assignments per class/period/day');
    console.log('   3. ✅ No complex timing calculations');
    console.log('   4. ✅ Easy bulk entry creation');
    console.log('   5. ✅ Simple "Period 1 = English" structure');
    console.log('\n🔧 Key API Endpoints:');
    console.log('   POST /api/timetable/config - Create timetable config');
    console.log('   POST /api/timetable/bulk-entries - Create multiple entries');
    console.log('   GET /api/timetable/class/:id - Get class timetable');
    console.log('   GET /api/timetable/teacher/:id - Get teacher timetable');
    console.log('\n⚠️  Note: You need to replace placeholder IDs with actual database IDs');
}

runTests().catch(console.error);
