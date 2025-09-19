const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testPasswordUpdate() {
    console.log('🧪 Testing Password Update Endpoint\n');

    // Test data
    const testUser = {
        phone_number: '1111111109', // Using existing staff phone
        password: 'Staff@123' // Current default password
    };

    try {
        // Step 1: Login to get token
        console.log('1️⃣ Logging in to get authentication token...');
        const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, testUser);

        if (loginResponse.data.status !== 'success') {
            throw new Error('Login failed');
        }

        const token = loginResponse.data.data.token;
        const user = loginResponse.data.data.user;
        console.log(`✅ Login successful for ${user.full_name} (${user.role})`);
        console.log(`📱 Phone: ${user.phone_number}`);
        console.log(`🔑 Token: ${token.substring(0, 20)}...\n`);

        // Step 2: Test password update with correct current password
        console.log('2️⃣ Testing password update with correct current password...');
        const updateData = {
            current_password: 'Staff@123',
            new_password: 'NewPassword123!'
        };

        const updateResponse = await axios.put(`${BASE_URL}/api/auth/update-password`, updateData, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (updateResponse.data.status === 'success') {
            console.log('✅ Password updated successfully!');
            console.log(`📝 Response: ${updateResponse.data.message}\n`);
        } else {
            console.log('❌ Password update failed:', updateResponse.data.message);
        }

        // Step 3: Test login with new password
        console.log('3️⃣ Testing login with new password...');
        const newLoginData = {
            phone_number: testUser.phone_number,
            password: updateData.new_password
        };

        const newLoginResponse = await axios.post(`${BASE_URL}/api/auth/login`, newLoginData);

        if (newLoginResponse.data.status === 'success') {
            console.log('✅ Login with new password successful!');
            console.log(`🔑 New token: ${newLoginResponse.data.data.token.substring(0, 20)}...\n`);
        } else {
            console.log('❌ Login with new password failed:', newLoginResponse.data.message);
        }

        // Step 4: Test password update with wrong current password
        console.log('4️⃣ Testing password update with wrong current password...');
        const wrongUpdateData = {
            current_password: 'WrongPassword',
            new_password: 'AnotherPassword123!'
        };

        try {
            const wrongUpdateResponse = await axios.put(`${BASE_URL}/api/auth/update-password`, wrongUpdateData, {
                headers: {
                    'Authorization': `Bearer ${newLoginResponse.data.data.token}`,
                    'Content-Type': 'application/json'
                }
            });
            console.log('❌ Should have failed but got:', wrongUpdateResponse.data);
        } catch (error) {
            if (error.response?.status === 401) {
                console.log('✅ Correctly rejected wrong current password');
                console.log(`📝 Error: ${error.response.data.message}\n`);
            } else {
                console.log('❌ Unexpected error:', error.response?.data || error.message);
            }
        }

        // Step 5: Test validation errors
        console.log('5️⃣ Testing validation errors...');

        // Test missing fields
        try {
            await axios.put(`${BASE_URL}/api/auth/update-password`, {}, {
                headers: {
                    'Authorization': `Bearer ${newLoginResponse.data.data.token}`,
                    'Content-Type': 'application/json'
                }
            });
            console.log('❌ Should have failed for missing fields');
        } catch (error) {
            if (error.response?.status === 400) {
                console.log('✅ Correctly rejected missing fields');
                console.log(`📝 Error: ${error.response.data.message}\n`);
            }
        }

        // Test short password
        try {
            await axios.put(`${BASE_URL}/api/auth/update-password`, {
                current_password: updateData.new_password,
                new_password: '123'
            }, {
                headers: {
                    'Authorization': `Bearer ${newLoginResponse.data.data.token}`,
                    'Content-Type': 'application/json'
                }
            });
            console.log('❌ Should have failed for short password');
        } catch (error) {
            if (error.response?.status === 400) {
                console.log('✅ Correctly rejected short password');
                console.log(`📝 Error: ${error.response.data.message}\n`);
            }
        }

        // Step 6: Reset password back to original for cleanup
        console.log('6️⃣ Resetting password back to original...');
        const resetData = {
            current_password: updateData.new_password,
            new_password: testUser.password
        };

        const resetResponse = await axios.put(`${BASE_URL}/api/auth/update-password`, resetData, {
            headers: {
                'Authorization': `Bearer ${newLoginResponse.data.data.token}`,
                'Content-Type': 'application/json'
            }
        });

        if (resetResponse.data.status === 'success') {
            console.log('✅ Password reset to original successfully!');
            console.log('🧹 Cleanup completed\n');
        } else {
            console.log('❌ Password reset failed:', resetResponse.data.message);
        }

        console.log('🎉 All password update tests completed!');

    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
        if (error.response?.status) {
            console.log(`📊 Status: ${error.response.status}`);
        }
    }
}

// Run the test
testPasswordUpdate();
