// Quick script to check admin users
import { adminSupabase } from './src/config/supabase.js';

async function checkAdmin() {
    console.log('\n🔍 Checking for admin users...\n');

    const { data: admins, error } = await adminSupabase
        .from('users')
        .select('id, phone_number, email, full_name, role, created_at')
        .eq('role', 'admin');

    if (error) {
        console.error('❌ Error:', error.message);
        return;
    }

    if (!admins || admins.length === 0) {
        console.log('❌ NO ADMIN FOUND!\n');
        console.log('Create one with:');
        console.log('curl -X POST http://localhost:3000/api/system/register-first-admin \\');
        console.log('  -H "Content-Type: application/json" \\');
        console.log('  -d \'{"phone_number":"1111111111","password":"Admin@123","full_name":"Admin","email":"admin@school.com"}\'');
        return;
    }

    console.log(`✅ Found ${admins.length} admin(s):\n`);
    admins.forEach((admin, i) => {
        console.log(`${i + 1}. ${admin.full_name}`);
        console.log(`   Phone: ${admin.phone_number}`);
        console.log(`   Email: ${admin.email || 'Not set'}`);
        console.log('');
    });

    console.log('📝 Use this to run tests:');
    console.log(`ADMIN_PHONE="${admins[0].phone_number}" ADMIN_PASSWORD="YourPassword" node test_complete_chat_system_v2.js\n`);
}

checkAdmin();

