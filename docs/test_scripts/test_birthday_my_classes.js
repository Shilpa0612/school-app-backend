import { config } from 'dotenv';
import fetch from 'node-fetch';

config();

const BASE_URL = 'https://ajws-school-ba8ae5e3f955.herokuapp.com/api';
// const BASE_URL = 'http://localhost:3000/api'; // For local testing

async function testBirthdayMyClasses() {
    try {
        console.log('🧪 Testing Birthday My-Classes Endpoint with Class Division Info');
        console.log('='.repeat(60));

        // You'll need to get a valid teacher JWT token
        const teacherToken = process.env.TEACHER_TOKEN;

        if (!teacherToken) {
            console.log('❌ TEACHER_TOKEN not found in environment variables');
            console.log('Please set TEACHER_TOKEN with a valid teacher JWT token');
            return;
        }

        console.log('✅ Teacher token found');

        // Test the endpoint
        const response = await fetch(`${BASE_URL}/birthdays/my-classes`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${teacherToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.log(`❌ Request failed with status: ${response.status}`);
            console.log(`Error: ${errorText}`);
            return;
        }

        const data = await response.json();

        console.log('✅ Request successful!');
        console.log('\n📊 Response Structure:');
        console.log(JSON.stringify(data, null, 2));

        // Test with different dates to find birthdays
        console.log('\n🔍 Testing with different dates to find birthdays...');

        // Test with a date range (next 30 days)
        const today = new Date();
        const endDate = new Date();
        endDate.setDate(today.getDate() + 30);

        const dateRangeResponse = await fetch(`${BASE_URL}/birthdays/my-classes?start_date=${today.toISOString().split('T')[0]}&end_date=${endDate.toISOString().split('T')[0]}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${teacherToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (dateRangeResponse.ok) {
            const dateRangeData = await dateRangeResponse.json();
            console.log('\n📅 Date Range Test (Next 30 days):');
            console.log(`Found ${dateRangeData.data.birthdays?.length || 0} birthdays`);

            if (dateRangeData.data.birthdays && dateRangeData.data.birthdays.length > 0) {
                console.log('✅ Found birthdays with class division info:');
                dateRangeData.data.birthdays.slice(0, 3).forEach((student, index) => {
                    console.log(`   ${index + 1}. ${student.full_name} - ${student.class_division?.name || 'Unknown Class'}`);
                });
            }
        }

        // Validate the new class division structure
        if (data.status === 'success' && data.data.birthdays) {
            console.log('\n🔍 Validating Class Division Information:');

            data.data.birthdays.forEach((student, index) => {
                console.log(`\n👤 Student ${index + 1}: ${student.full_name}`);
                console.log(`   📚 Class Division ID: ${student.class_division?.id || 'N/A'}`);
                console.log(`   🏫 Class Division Name: ${student.class_division?.name || 'N/A'}`);
                console.log(`   📖 Level: ${student.class_division?.level || 'N/A'}`);
                console.log(`   🔢 Division: ${student.class_division?.division || 'N/A'}`);
                console.log(`   📊 Sequence: ${student.class_division?.sequence_number || 'N/A'}`);
            });

            if (data.data.class_divisions && data.data.class_divisions.length > 0) {
                console.log('\n🏫 Class Divisions Summary:');
                data.data.class_divisions.forEach((division, index) => {
                    console.log(`   ${index + 1}. ${division.name} (ID: ${division.id})`);
                });
            }

            console.log('\n✅ Class division information successfully added to response!');
        }

        // Check if class divisions are populated even when no birthdays
        if (data.status === 'success') {
            console.log('\n🔍 Checking Class Divisions (Even with No Birthdays):');

            if (data.data.class_division_ids && data.data.class_division_ids.length > 0) {
                console.log(`✅ Teacher is assigned to ${data.data.class_division_ids.length} class divisions`);

                if (data.data.class_divisions && data.data.class_divisions.length > 0) {
                    console.log('✅ Class divisions details are populated:');
                    data.data.class_divisions.forEach((division, index) => {
                        console.log(`   ${index + 1}. ${division.name} (ID: ${division.id})`);
                        console.log(`      Division: ${division.division}, Level: ${division.level}, Sequence: ${division.sequence_number}`);
                    });
                } else {
                    console.log('❌ Class divisions array is empty (should contain division details)');
                }
            } else {
                console.log('ℹ️ Teacher is not assigned to any class divisions');
            }

            if (data.data.birthdays && data.data.birthdays.length === 0) {
                console.log('\n📅 No birthdays today, but class divisions should still be shown');
            }
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

// Run the test
testBirthdayMyClasses();
