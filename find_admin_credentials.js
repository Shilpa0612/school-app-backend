/**
 * Helper script to find admin credentials in your database
 * 
 * Usage: node find_admin_credentials.js
 */

import { adminSupabase } from './src/config/supabase.js';

async function findAdminCredentials() {
    console.log('\n🔍 Finding Admin Credentials in Database...\n');

    try {
        // Find all admin users
        const { data: admins, error } = await adminSupabase
            .from('users')
            .select('id, phone_number, email, full_name, role, created_at')
            .eq('role', 'admin')
            .order('created_at', { ascending: true });

        if (error) {
            console.error('❌ Error querying database:', error.message);
            return;
        }

        if (!admins || admins.length === 0) {
            console.log('❌ No admin users found in database!');
            console.log('\n💡 You need to create an admin first:');
            console.log('\n   curl -X POST http://localhost:3000/api/system/register-first-admin \\');
            console.log('     -H "Content-Type: application/json" \\');
            console.log('     -d \'{');
            console.log('       "phone_number": "1111111111",');
            console.log('       "password": "Admin@123",');
            console.log('       "full_name": "System Admin",');
            console.log('       "email": "admin@school.com"');
            console.log('     }\'');
            return;
        }

        console.log(`✅ Found ${admins.length} admin user(s):\n`);

        admins.forEach((admin, index) => {
            console.log(`${index + 1}. ${admin.full_name || 'Unknown'}`);
            console.log(`   User ID: ${admin.id}`);
            console.log(`   Phone: ${admin.phone_number}`);
            console.log(`   Email: ${admin.email || 'Not set'}`);
            console.log(`   Created: ${admin.created_at}`);
            console.log('');
        });

        console.log('📌 To run tests with this admin:');
        console.log(`\n   ADMIN_PHONE="${admins[0].phone_number}" ADMIN_PASSWORD="YourAdminPassword" node test_complete_chat_system_v2.js\n`);

        console.log('⚠️  Note: We can see the phone number but NOT the password (it\'s hashed).');
        console.log('If you don\'t know the password, you have these options:\n');
        console.log('   Option 1: Reset password via your app/API');
        console.log('   Option 2: Create a new admin user');
        console.log('   Option 3: Use SQL to update password_hash directly\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

findAdminCredentials();

