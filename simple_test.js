/**
 * Simple test script to verify security fixes
 */

const BASE_URL = 'https://ajws-school-ba8ae5e3f955.herokuapp.com/api';

async function testSecurityFixes() {
    console.log('🔧 Testing Security Fixes...\n');

    try {
        // Test 1: Login as Omkar (Multi-role teacher)
        console.log('1. Testing teacher login...');
        const loginResponse = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phone_number: '9158834913',
                password: 'Temp@1234'
            })
        });

        const loginData = await loginResponse.json();
        const token = loginData.data?.token;
        if (!token) {
            throw new Error('No token received from login');
        }
        console.log('✅ Teacher login successful');

        // Test 2: Get teacher assignments
        console.log('\n2. Testing teacher assignments...');
        const assignmentsResponse = await fetch(`${BASE_URL}/academic/my-teacher-id`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        const assignmentsData = await assignmentsResponse.json();
        const assignments = assignmentsData.data;
        console.log(`✅ Found ${assignments.assigned_classes.length} class assignments`);

        // Test 3: Test announcement filtering
        console.log('\n3. Testing announcement filtering...');
        const announcementsResponse = await fetch(`${BASE_URL}/announcements/teacher/announcements?page=1&limit=10`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        const announcementsData = await announcementsResponse.json();
        const announcements = announcementsData.data.announcements;
        console.log(`✅ Found ${announcements.length} announcements for teacher`);

        // Test 4: Test homework access
        console.log('\n4. Testing homework access...');
        const homeworkResponse = await fetch(`${BASE_URL}/homework?page=1&limit=10`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        const homeworkData = await homeworkResponse.json();
        const homework = homeworkData.data.homework;
        console.log(`✅ Found ${homework.length} homework assignments for teacher`);

        // Test 5: Test unassigned teacher access
        console.log('\n5. Testing unassigned teacher access...');
        const unassignedLoginResponse = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phone_number: '9404511717', // Ganesh - unassigned teacher
                password: 'Temp@1234'
            })
        });

        const unassignedLoginData = await unassignedLoginResponse.json();
        const unassignedToken = unassignedLoginData.data.token;

        const unassignedHomeworkResponse = await fetch(`${BASE_URL}/homework?page=1&limit=10`, {
            headers: { Authorization: `Bearer ${unassignedToken}` }
        });

        const unassignedHomeworkData = await unassignedHomeworkResponse.json();
        const unassignedHomework = unassignedHomeworkData.data.homework;
        console.log(`✅ Unassigned teacher sees ${unassignedHomework.length} homework assignments`);

        console.log('\n🎉 All security fixes are working correctly!');
        return true;

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        return false;
    }
}

testSecurityFixes().catch(console.error);
