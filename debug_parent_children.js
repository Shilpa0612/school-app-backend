/**
 * Debug script to check parent's children and their classes
 */

const BASE_URL = 'https://ajws-school-ba8ae5e3f955.herokuapp.com/api';

async function debugParentChildren() {
    console.log('🔍 DEBUGGING PARENT CHILDREN AND CLASSES\n');

    try {
        // Login as parent (Amit)
        console.log('1. Logging in as parent (Amit)...');
        const parentLoginResponse = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phone_number: '8087478036', // Amit - Parent
                password: 'Temp@1234'
            })
        });

        const parentLoginData = await parentLoginResponse.json();
        const parentToken = parentLoginData.data.token;

        console.log('✅ Parent login successful');

        // Get parent's children
        console.log('\n2. Getting parent\'s children...');
        const childrenResponse = await fetch(`${BASE_URL}/users/children`, {
            headers: { Authorization: `Bearer ${parentToken}` }
        });

        const childrenData = await childrenResponse.json();
        const children = childrenData.data.children;

        console.log(`📋 Parent has ${children.length} children:`);
        children.forEach(child => {
            console.log(`   - ${child.full_name} (ID: ${child.id})`);
            console.log(`     Current Class: ${child.current_class?.name || 'Unknown'} ${child.current_class?.division || ''}`);
            console.log(`     Class ID: ${child.current_class?.id || 'Unknown'}`);
        });

        // Get parent's homework
        console.log('\n3. Getting parent\'s homework...');
        const homeworkResponse = await fetch(`${BASE_URL}/homework?page=1&limit=50`, {
            headers: { Authorization: `Bearer ${parentToken}` }
        });

        const homeworkData = await homeworkResponse.json();
        const homework = homeworkData.data.homework;

        console.log(`📚 Parent sees ${homework.length} homework assignments:`);
        homework.forEach(hw => {
            const className = `${hw.class_division?.level?.name || ''} ${hw.class_division?.division || ''}`.trim();
            console.log(`   - "${hw.title}" - Class: ${className} (ID: ${hw.class_division_id})`);
        });

        // Check if parent has children in the classes they can see homework for
        console.log('\n4. Checking class assignments...');
        const parentClassIds = children.map(child => child.current_class?.id).filter(Boolean);
        const homeworkClassIds = homework.map(hw => hw.class_division_id);

        console.log(`📋 Parent's children are in classes: ${parentClassIds.join(', ')}`);
        console.log(`📚 Homework is from classes: ${homeworkClassIds.join(', ')}`);

        const unauthorizedClasses = homeworkClassIds.filter(hwClassId =>
            !parentClassIds.includes(hwClassId)
        );

        if (unauthorizedClasses.length > 0) {
            console.log(`❌ UNAUTHORIZED CLASSES: ${unauthorizedClasses.join(', ')}`);
            console.log('❌ Parent can see homework from classes their children are not in!');
        } else {
            console.log('✅ Parent can only see homework from their children\'s classes');
        }

    } catch (error) {
        console.error('❌ Debug failed:', error.message);
    }
}

debugParentChildren().catch(console.error);
