/**
 * Debug script to understand the announcement filtering issue
 */

const BASE_URL = 'https://ajws-school-ba8ae5e3f955.herokuapp.com/api';

// Helper function to make HTTP requests
async function makeRequest(url, options = {}) {
    const response = await fetch(url, {
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        },
        ...options
    });

    const data = await response.json();

    if (!response.ok) {
        const error = new Error(data.message || 'Request failed');
        error.response = { data, status: response.status };
        throw error;
    }

    return { data };
}

async function debugAnnouncementIssue() {
    console.log('🔍 Debugging Announcement Filtering Issue...\n');

    try {
        // Test with Ganesh (Unassigned teacher)
        console.log('1. Logging in as Ganesh Madhukar Dabhade (Unassigned teacher)...');
        const loginResponse = await makeRequest(`${BASE_URL}/auth/login`, {
            method: 'POST',
            body: JSON.stringify({
                phone_number: '9404511717',
                password: 'Temp@1234'
            })
        });

        const token = loginResponse.data.data.token;
        console.log('✅ Login successful');

        // Get teacher assignments
        console.log('\n2. Getting teacher assignments...');
        const assignmentsResponse = await makeRequest(`${BASE_URL}/academic/my-teacher-id`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` }
        });

        const assignments = assignmentsResponse.data.data;
        console.log('📋 Teacher Assignments:');
        console.log(`   - Class Divisions: ${assignments.class_divisions?.map(cd => cd.division).join(', ') || 'None'}`);
        console.log(`   - Total Classes: ${assignments.class_divisions?.length || 0}`);
        console.log(`   - Subjects: ${assignments.subjects?.join(', ') || 'None'}`);
        console.log(`   - Total Subjects: ${assignments.subjects?.length || 0}`);

        // Get teacher announcements
        console.log('\n3. Getting teacher announcements...');
        const announcementsResponse = await makeRequest(`${BASE_URL}/announcements/teacher/announcements?page=1&limit=50`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` }
        });

        const announcements = announcementsResponse.data.data.announcements;
        console.log(`📢 Found ${announcements.length} announcements`);

        // Analyze each announcement
        console.log('\n4. Analyzing announcements:');
        announcements.forEach((ann, index) => {
            console.log(`\n   Announcement ${index + 1}: "${ann.title}"`);
            console.log(`   - Target Roles: ${JSON.stringify(ann.target_roles)}`);
            console.log(`   - Target Classes: ${JSON.stringify(ann.target_classes)}`);
            console.log(`   - Target Subjects: ${JSON.stringify(ann.target_subjects)}`);

            // Check why this announcement is visible
            const hasTeacherRole = ann.target_roles?.includes('teacher') || false;
            const hasEmptyRoles = !ann.target_roles || ann.target_roles.length === 0;
            const hasClassTargeting = ann.target_classes && ann.target_classes.length > 0;
            const hasAuthorizedClass = hasClassTargeting &&
                ann.target_classes.some(classId => assignments.class_divisions?.some(cd => cd.class_division_id === classId));

            console.log(`   - Has Teacher Role: ${hasTeacherRole}`);
            console.log(`   - Has Empty Roles: ${hasEmptyRoles}`);
            console.log(`   - Has Class Targeting: ${hasClassTargeting}`);
            console.log(`   - Has Authorized Class: ${hasAuthorizedClass}`);

            if (hasEmptyRoles && hasClassTargeting) {
                console.log(`   🚨 ISSUE: This announcement has empty roles but class targeting!`);
            }
        });

    } catch (error) {
        console.error('❌ Debug failed:', error.response?.data || error.message);
    }
}

debugAnnouncementIssue().catch(console.error);
