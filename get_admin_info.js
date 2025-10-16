// Simple admin checker
const fetch = require('node-fetch');
const BASE_URL = 'http://localhost:3000';

async function tryLogin(phone, password) {
    try {
        const response = await fetch(`${BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone_number: phone, password })
        });

        const data = await response.json();
        return { success: response.ok, data };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function findAdmin() {
    console.log('\n🔍 Trying common admin credentials...\n');

    const commonAdmins = [
        { phone: '1111111111', password: 'Admin@123' },
        { phone: '1234567890', password: 'Admin@123' },
        { phone: '9999999999', password: 'Admin@123' },
        { phone: '0000000000', password: 'Admin@123' }
    ];

    for (const admin of commonAdmins) {
        process.stdout.write(`Testing ${admin.phone}... `);
        const result = await tryLogin(admin.phone, admin.password);

        if (result.success) {
            console.log('✅ SUCCESS!\n');
            console.log('📌 Admin Found:');
            console.log(`   Phone: ${admin.phone}`);
            console.log(`   Password: ${admin.password}`);
            console.log(`   Name: ${result.data.data.user.full_name}`);
            console.log(`   User ID: ${result.data.data.user.id}`);
            console.log('\n✅ Run tests with:');
            console.log(`   ADMIN_PHONE="${admin.phone}" ADMIN_PASSWORD="${admin.password}" node test_complete_chat_system_v2.js\n`);
            console.log('Or simply:');
            console.log(`   node test_complete_chat_system_v2.js\n`);
            return;
        } else {
            console.log('❌');
        }
    }

    console.log('\n❌ No admin found with common credentials.');
    console.log('\n💡 Create a new admin:');
    console.log('\ncurl -X POST http://localhost:3000/api/system/register-first-admin \\');
    console.log('  -H "Content-Type: application/json" \\');
    console.log('  -d \'{"phone_number":"1111111111","password":"Admin@123","full_name":"Test Admin","email":"admin@test.com"}\'');
}

findAdmin().catch(console.error);

