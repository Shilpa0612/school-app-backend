// Simple test to debug date conversion logic
console.log('🧪 Testing Date Conversion Logic');
console.log('='.repeat(50));

// Test the problematic date
const testDate = '2025-07-30';

console.log('\n📅 Test Date:', testDate);

// Method 1: Old approach (what was broken)
console.log('\n🔍 Method 1: Old approach');
const oldDate = new Date(testDate);
oldDate.setHours(23, 59, 59, 999);
console.log('Input:', testDate);
console.log('Old Date object:', oldDate);
console.log('Old Date ISO:', oldDate.toISOString());

// Method 2: New approach (what should work)
console.log('\n🔍 Method 2: New approach');
const newDate = new Date(testDate + 'T23:59:59.999Z');
console.log('Input:', testDate + 'T23:59:59.999Z');
console.log('New Date object:', newDate);
console.log('New Date ISO:', newDate.toISOString());

// Method 3: Direct string comparison
console.log('\n🔍 Method 3: Direct string comparison');
const directString = testDate + 'T23:59:59.999Z';
console.log('Direct string:', directString);

// Test comparison
console.log('\n🔍 Test Comparison');
const dbValue = '2025-07-30T23:59:59+00:00';
console.log('Database value:', dbValue);
console.log('Old method result:', dbValue <= oldDate.toISOString());
console.log('New method result:', dbValue <= newDate.toISOString());
console.log('Direct string result:', dbValue <= directString);

// Test with actual homework due date format
console.log('\n🔍 Test with actual homework format');
const homeworkDueDate = '2025-07-30T23:59:59+00:00';
console.log('Homework due date:', homeworkDueDate);
console.log('Old method result:', homeworkDueDate <= oldDate.toISOString());
console.log('New method result:', homeworkDueDate <= newDate.toISOString());
console.log('Direct string result:', homeworkDueDate <= directString);

// Test timezone handling
console.log('\n🔍 Timezone handling');
const localDate = new Date(testDate);
console.log('Local date (no time):', localDate);
console.log('Local date ISO:', localDate.toISOString());

const utcDate = new Date(testDate + 'T00:00:00.000Z');
console.log('UTC date (start of day):', utcDate);
console.log('UTC date ISO:', utcDate.toISOString());
