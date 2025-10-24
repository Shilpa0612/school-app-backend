/**
 * Debug script to check teacher announcement filtering
 */

const BASE_URL = 'https://ajws-school-ba8ae5e3f955.herokuapp.com/api';

async function debugAnnouncementFiltering() {
    console.log('🔍 DEBUGGING TEACHER ANNOUNCEMENT FILTERING\n');

    try {
        // Login as teacher
        console.log('1. Logging in as teacher (Omkar)...');
        const teacherLoginResponse = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phone_number: '9158834913', // Omkar - Teacher
                password: 'Temp@1234'
            })
        });

        const teacherLoginData = await teacherLoginResponse.json();
        const teacherToken = teacherLoginData.data.token;

        console.log('✅ Teacher login successful');

        // Get teacher assignments
        console.log('\n2. Getting teacher assignments...');
        const assignmentsResponse = await fetch(`${BASE_URL}/academic/my-teacher-id`, {
            headers: { Authorization: `Bearer ${teacherToken}` }
        });

        const assignmentsData = await assignmentsResponse.json();
        const assignments = assignmentsData.data;

        console.log(`📋 Teacher assignments:`);
        assignments.assigned_classes.forEach(assignment => {
            console.log(`   - ${assignment.class_name} (ID: ${assignment.class_division_id})`);
        });

        // Get announcements
        console.log('\n3. Getting announcements...');
        const announcementsResponse = await fetch(`${BASE_URL}/announcements/teacher/announcements?page=1&limit=50`, {
            headers: { Authorization: `Bearer ${teacherToken}` }
        });

        const announcementsData = await announcementsResponse.json();
        const announcements = announcementsData.data.announcements;

        console.log(`📢 Found ${announcements.length} announcements:`);

        // Check each announcement
        announcements.forEach((ann, index) => {
            console.log(`\n   ${index + 1}. "${ann.title}"`);
            console.log(`      - Target Roles: ${JSON.stringify(ann.target_roles)}`);
            console.log(`      - Target Classes: ${JSON.stringify(ann.target_classes)}`);
            console.log(`      - Target Subjects: ${JSON.stringify(ann.target_subjects)}`);

            // Check if this announcement should be visible
            const hasTeacherRole = ann.target_roles && ann.target_roles.includes('teacher');
            const hasEmptyTargetRoles = !ann.target_roles || ann.target_roles.length === 0;
            const hasTargetClasses = ann.target_classes && ann.target_classes.length > 0;
            const hasEmptyTargetClasses = !ann.target_classes || ann.target_classes.length === 0;

            console.log(`      - Has Teacher Role: ${hasTeacherRole}`);
            console.log(`      - Has Empty Target Roles: ${hasEmptyTargetRoles}`);
            console.log(`      - Has Target Classes: ${hasTargetClasses}`);
            console.log(`      - Has Empty Target Classes: ${hasEmptyTargetClasses}`);

            // Check if announcement is targeted to Grade 1 A
            const isGrade1A = ann.target_classes && ann.target_classes.includes('f98eeccd-d3ff-49b9-9d0d-c433ccf3f567');
            if (isGrade1A) {
                console.log(`      ❌ PROBLEM: This announcement is targeted to Grade 1 A (not assigned to teacher)`);
            }

            // Check if announcement is targeted to teacher's assigned classes
            const teacherClassIds = assignments.assigned_classes.map(a => a.class_division_id);
            const isTargetedToTeacherClasses = ann.target_classes && ann.target_classes.some(classId => teacherClassIds.includes(classId));
            if (isTargetedToTeacherClasses) {
                console.log(`      ✅ OK: This announcement is targeted to teacher's assigned classes`);
            }
        });

    } catch (error) {
        console.error('❌ Debug failed:', error.message);
    }
}

debugAnnouncementFiltering().catch(console.error);
