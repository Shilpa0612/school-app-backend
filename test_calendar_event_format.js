// Test script to demonstrate correct event date format for calendar API

console.log('📅 Calendar Event Date Format Guide\n');

console.log('✅ CORRECT FORMATS:');
console.log('1. UTC format (recommended):');
console.log('   "event_date": "2025-09-23T00:00:00Z"');
console.log('   - This preserves the exact date without timezone conversion');
console.log('   - The "Z" indicates UTC timezone');
console.log('   - Time will remain as 00:00:00 (midnight)');

console.log('\n2. Local date format (if timezone is specified):');
console.log('   "event_date": "2025-09-23T00:00:00"');
console.log('   "timezone": "Asia/Kolkata"');
console.log('   - This will be converted from IST to UTC');
console.log('   - IST is UTC+5:30, so 00:00 IST becomes 18:30 UTC (previous day)');

console.log('\n❌ INCORRECT FORMATS:');
console.log('1. Don\'t mix UTC format with timezone:');
console.log('   "event_date": "2025-09-23T00:00:00Z"');
console.log('   "timezone": "Asia/Kolkata"');
console.log('   - This will cause double conversion issues');

console.log('\n📝 EXAMPLE REQUEST BODY:');
console.log(JSON.stringify({
    "title": "Event title 1",
    "description": "Event description",
    "event_date": "2025-09-23T00:00:00Z",  // ✅ Correct - UTC format
    "event_type": "school_wide",
    "is_single_day": true,
    "start_time": "09:00:00",
    "end_time": "10:00:00",
    "event_category": "holiday"
    // Note: Don't include timezone when using UTC format
}, null, 2));

console.log('\n🔧 WHAT WAS FIXED:');
console.log('- The API now properly handles UTC format dates (ending with Z)');
console.log('- No timezone conversion is applied to UTC dates');
console.log('- Only local dates with timezone specified get converted');
console.log('- This prevents time from being changed when editing events');
