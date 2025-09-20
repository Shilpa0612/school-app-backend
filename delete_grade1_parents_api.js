/**
 * Script to delete Grade 1 parents using API endpoints
 * Run this with Node.js after updating the BASE_URL and AUTH_TOKEN
 */

const BASE_URL = 'http://localhost:3000'; // Update this to your server URL
const AUTH_TOKEN = 'YOUR_AUTH_TOKEN_HERE'; // Update with your actual auth token

// Phone numbers of all Grade 1 parents to delete
const PARENT_PHONE_NUMBERS = [
    '9404002011',  // Roshan Eknath Parmeshwar
    '8208551468',  // Raushan Umesh Prasad Singh
    '8459514318',  // Kishor Bhanudas Tirukhe
    '9588605473',  // Shaikh Musa
    '9420818888',  // Prashant Madhavrao Pawar
    '8770048722',  // Vipin kumar mishra
    '8149260449',  // Pratik Prabhakar Pise
    '7350969503',  // Manoj Gopikishan Agrawal
    '7218594090',  // Shru Khan
    '8087478036',  // Amit
    '9158190100',  // Raghunath kautikrao Sahane
    '9970045740',  // Sachin Babanrao Shinde
    '9890109143',  // Baliram Babanrao Choudhari
    '9028008020',  // Punit Nirmal Jogad
    '8484003111',  // Dnyaneshwar Patilba Bhusare
    '9158759550',  // Chetan Bharat Rathod
    '8830069989',  // Anit Rai
    '9922436652',  // Kakasaheb ramro Jamkar
    '9226288465',  // Ashok Chandrakant Gavali
    '8208123943'   // Mahavir Ramjivan Gaud
];

async function findParentByPhone(phoneNumber) {
    try {
        const response = await fetch(`${BASE_URL}/api/parents`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${AUTH_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const parent = data.data?.parents?.find(p => p.phone_number === phoneNumber);
        return parent;
    } catch (error) {
        console.error(`Error finding parent with phone ${phoneNumber}:`, error.message);
        return null;
    }
}

async function deleteParent(parentId, parentName, phoneNumber) {
    try {
        const response = await fetch(`${BASE_URL}/api/parents/${parentId}?force=true`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${AUTH_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log(`✅ Deleted parent: ${parentName} (${phoneNumber})`);
        console.log(`   - Removed ${data.data.removed_mappings_count} student mappings`);
        return true;
    } catch (error) {
        console.error(`❌ Error deleting parent ${parentName} (${phoneNumber}):`, error.message);
        return false;
    }
}

async function deleteAllGrade1Parents() {
    console.log('🔍 Starting Grade 1 parent deletion process...\n');
    
    let foundCount = 0;
    let deletedCount = 0;
    let errorCount = 0;

    for (const phoneNumber of PARENT_PHONE_NUMBERS) {
        console.log(`Searching for parent with phone: ${phoneNumber}`);
        
        const parent = await findParentByPhone(phoneNumber);
        
        if (parent) {
            foundCount++;
            console.log(`Found: ${parent.full_name} (ID: ${parent.id})`);
            
            const deleted = await deleteParent(parent.id, parent.full_name, phoneNumber);
            if (deleted) {
                deletedCount++;
            } else {
                errorCount++;
            }
        } else {
            console.log(`Parent with phone ${phoneNumber} not found (may already be deleted)`);
        }
        
        console.log(''); // Empty line for readability
        
        // Add small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\n📊 Deletion Summary:');
    console.log(`   - Parents searched: ${PARENT_PHONE_NUMBERS.length}`);
    console.log(`   - Parents found: ${foundCount}`);
    console.log(`   - Parents deleted: ${deletedCount}`);
    console.log(`   - Errors: ${errorCount}`);
    
    if (deletedCount === foundCount && errorCount === 0) {
        console.log('\n🎉 All Grade 1 parents deleted successfully!');
    } else if (errorCount > 0) {
        console.log('\n⚠️ Some parents could not be deleted. Check the errors above.');
    }
}

// Run the deletion process
if (require.main === module) {
    // Check if auth token is set
    if (AUTH_TOKEN === 'YOUR_AUTH_TOKEN_HERE') {
        console.error('❌ Please update the AUTH_TOKEN in this script before running.');
        console.error('You can get your auth token by logging in as admin/principal.');
        process.exit(1);
    }

    deleteAllGrade1Parents().catch(error => {
        console.error('💥 Script failed:', error);
        process.exit(1);
    });
}

module.exports = { deleteAllGrade1Parents, findParentByPhone, deleteParent };
