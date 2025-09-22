#!/usr/bin/env node

/**
 * Test Parent Topic Subscription System
 * This script tests the automatic topic subscription for parents
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:3000';
const TEST_PARENT_TOKEN = 'your_jwt_token_here'; // Replace with a real parent JWT token

console.log('🧪 Testing Parent Topic Subscription System...\n');

// Test 1: Get available topics for a parent
async function testGetAvailableTopics() {
    console.log('1. Testing Get Available Topics...');

    try {
        const response = await axios.get(`${BASE_URL}/api/device-tokens/available-topics`, {
            headers: {
                'Authorization': `Bearer ${TEST_PARENT_TOKEN}`
            }
        });

        console.log('   ✅ Available topics retrieved successfully');
        console.log('   📊 Total topics:', response.data.data.total_topics);
        console.log('   📋 School-wide topics:', response.data.data.categorized_topics.schoolWide?.length || 0);
        console.log('   📋 Class-specific topics:', response.data.data.categorized_topics.classSpecific?.length || 0);
        console.log('   📋 Student-specific topics:', response.data.data.categorized_topics.studentSpecific?.length || 0);

        // Show sample topics
        if (response.data.data.all_topics.length > 0) {
            console.log('   🔍 Sample topics:');
            response.data.data.all_topics.slice(0, 5).forEach(topic => {
                console.log(`      - ${topic}`);
            });
        }

        return response.data.data;

    } catch (error) {
        console.log('   ❌ Failed to get available topics');
        console.log('   🔍 Error:', error.response?.data || error.message);
        return null;
    }
}

// Test 2: Register device token (should auto-subscribe to topics)
async function testDeviceRegistration() {
    console.log('\n2. Testing Device Registration with Auto-Subscription...');

    const deviceData = {
        device_token: 'test_device_token_' + Date.now(),
        platform: 'android',
        device_info: {
            model: 'Test Device',
            os_version: 'Android 13',
            app_version: '1.0.0'
        }
    };

    try {
        const response = await axios.post(`${BASE_URL}/api/device-tokens/register`, deviceData, {
            headers: {
                'Authorization': `Bearer ${TEST_PARENT_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('   ✅ Device registered successfully');

        if (response.data.data.topic_subscription) {
            const subscription = response.data.data.topic_subscription;
            console.log('   📱 Auto-subscription results:');
            console.log(`      - Total topics: ${subscription.total_topics}`);
            console.log(`      - Successful subscriptions: ${subscription.successful_subscriptions}`);
            console.log(`      - Failed subscriptions: ${subscription.failed_subscriptions}`);
        }

        return response.data.data.device_id;

    } catch (error) {
        console.log('   ❌ Device registration failed');
        console.log('   🔍 Error:', error.response?.data || error.message);
        return null;
    }
}

// Test 3: Test topic subscription manually
async function testManualTopicSubscription() {
    console.log('\n3. Testing Manual Topic Subscription...');

    try {
        const response = await axios.post(`${BASE_URL}/api/device-tokens/subscribe-topic`, {
            device_token: 'test_device_token_manual',
            topic: 'school_wide'
        }, {
            headers: {
                'Authorization': `Bearer ${TEST_PARENT_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('   ✅ Manual topic subscription successful');
        console.log('   📊 Response:', response.data);

    } catch (error) {
        console.log('   ❌ Manual topic subscription failed');
        console.log('   🔍 Error:', error.response?.data || error.message);
    }
}

// Test 4: Test notification sending to topics
async function testTopicNotification() {
    console.log('\n4. Testing Topic Notification Sending...');

    try {
        const response = await axios.post(`${BASE_URL}/api/device-tokens/test-notification`, {
            title: 'Test Topic Notification',
            body: 'This is a test notification sent to topics',
            data: {
                type: 'test',
                id: 'test-' + Date.now()
            }
        }, {
            headers: {
                'Authorization': `Bearer ${TEST_PARENT_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('   ✅ Topic notification sent successfully');
        console.log('   📊 Response:', response.data);

    } catch (error) {
        console.log('   ❌ Topic notification failed');
        console.log('   🔍 Error:', error.response?.data || error.message);
    }
}

// Test 5: Show topic examples
function showTopicExamples() {
    console.log('\n5. Topic Examples for Parents:');

    const examples = {
        'School-wide Topics': [
            'school_wide',
            'urgent_announcements',
            'school_events'
        ],
        'Class-specific Topics': [
            'class_announcements_grade1_a',
            'class_events_grade1_a',
            'class_homework_grade1_a',
            'class_classwork_grade1_a',
            'class_messages_grade1_a'
        ],
        'Student-specific Topics': [
            'student_attendance_student123',
            'student_birthday_student123',
            'student_specific_student123'
        ]
    };

    Object.entries(examples).forEach(([category, topics]) => {
        console.log(`   📋 ${category}:`);
        topics.forEach(topic => {
            console.log(`      - ${topic}`);
        });
    });
}

// Main test function
async function runAllTests() {
    console.log('🚀 Starting Parent Topic Subscription Tests...\n');

    // Show topic examples first
    showTopicExamples();

    // Test 1: Get available topics
    const availableTopics = await testGetAvailableTopics();

    // Test 2: Register device (auto-subscribe)
    const deviceId = await testDeviceRegistration();

    // Test 3: Manual topic subscription
    await testManualTopicSubscription();

    // Test 4: Send topic notification
    await testTopicNotification();

    console.log('\n🎉 Parent Topic Subscription Tests Complete!');

    if (availableTopics) {
        console.log('\n📋 Summary:');
        console.log(`✅ Found ${availableTopics.total_topics} topics for parent`);
        console.log(`✅ School-wide: ${availableTopics.categorized_topics.schoolWide?.length || 0} topics`);
        console.log(`✅ Class-specific: ${availableTopics.categorized_topics.classSpecific?.length || 0} topics`);
        console.log(`✅ Student-specific: ${availableTopics.categorized_topics.studentSpecific?.length || 0} topics`);
    }

    console.log('\n🔗 Next Steps:');
    console.log('1. Test with real mobile devices');
    console.log('2. Test with real parent accounts');
    console.log('3. Verify notifications are received on devices');
    console.log('4. Test different notification types');
}

// Run tests
runAllTests().catch(console.error);
