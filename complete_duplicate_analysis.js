/**
 * Complete analysis of duplicate parents across ALL grades
 * This identifies every parent that appears in multiple grades
 */

const allGradeParents = {
    grade1: [
        { phone: "9404002011", name: "Roshan Eknath Parmeshwar", admissions: ["1"] },
        { phone: "8208551468", name: "Raushan Umesh Prasad Singh", admissions: ["2"] },
        { phone: "8459514318", name: "Kishor Bhanudas Tirukhe", admissions: ["3"] },
        { phone: "9588605473", name: "Shaikh Musa", admissions: ["4"] },
        { phone: "9420818888", name: "Prashant Madhavrao Pawar", admissions: ["5"] },
        { phone: "8770048722", name: "Vipin kumar mishra", admissions: ["6"] },
        { phone: "8149260449", name: "Pratik Prabhakar Pise", admissions: ["7"] },
        { phone: "7350969503", name: "Manoj Gopikishan Agrawal", admissions: ["8"] },
        { phone: "7218594090", name: "Shru Khan", admissions: ["9"] },
        { phone: "8087478036", name: "Amit", admissions: ["10"] },
        { phone: "9158190100", name: "Raghunath kautikrao Sahane", admissions: ["11"] },
        { phone: "9970045740", name: "Sachin Babanrao Shinde", admissions: ["12"] },
        { phone: "9890109143", name: "Baliram Babanrao Choudhari", admissions: ["13"] },
        { phone: "9028008020", name: "Punit Nirmal Jogad", admissions: ["14"] },
        { phone: "8484003111", name: "Dnyaneshwar Patilba Bhusare", admissions: ["15"] },
        { phone: "9158759550", name: "Chetan Bharat Rathod", admissions: ["16"] },
        { phone: "8830069989", name: "Anit Rai", admissions: ["17"] },
        { phone: "9922436652", name: "Kakasaheb ramro Jamkar", admissions: ["18"] },
        { phone: "9226288465", name: "Ashok Chandrakant Gavali", admissions: ["19"] },
        { phone: "8208123943", name: "Mahavir Ramjivan Gaud", admissions: ["20"] }
    ],
    grade2: [
        { phone: "7709881063", name: "Babasaheb Tejrao Jadhav", admissions: ["22"] },
        { phone: "9975309600", name: "Deepak Kanhaiya Lal Verma", admissions: ["23"] },
        { phone: "7972556161", name: "Radhesham Kashinath Teple", admissions: ["24"] },
        { phone: "8668428522", name: "Subhash Ramnath Dhayde", admissions: ["25"] },
        { phone: "8142629034", name: "Dinesh Yadav", admissions: ["26"] },
        { phone: "9595963444", name: "Shailendra Janardhan Kshirsagar", admissions: ["27"] },
        { phone: "9552009914", name: "Sameer Hakeem Dange", admissions: ["28"] },
        { phone: "9404277377", name: "Govind Laxman Mule", admissions: ["29"] },
        { phone: "7058865799", name: "Haridas Vinayak Mandve", admissions: ["30"] },
        { phone: "9764642103", name: "Balasaheb prahlad randhe", admissions: ["31"] },
        { phone: "7385047800", name: "Narayan Kundlikrao Kakde", admissions: ["32"] },
        { phone: "8999003655", name: "Kunal babanrao varade", admissions: ["33"] },
        { phone: "9890109143", name: "Baliram Babanrao Choudhari", admissions: ["34"] }, // DUPLICATE from Grade 1
        { phone: "9766709708", name: "NITISH PANDIRANG UPADHYE", admissions: ["35"] },
        { phone: "9673774754", name: "Ishwar Rameshrao Raut", admissions: ["36"] },
        { phone: "9511716111", name: "Mahesh Machindra Dawkhar", admissions: ["37"] },
        { phone: "7822007544", name: "Shivhari Shankar Gutte", admissions: ["38"] },
        { phone: "9922939991", name: "Sunil Subhash Soni", admissions: ["39"] },
        { phone: "937054", name: "Ishwar Sominath Teple", admissions: ["40"] },
        { phone: "8484952644", name: "Anil Saluba Misal", admissions: ["41"] },
        { phone: "9503314033", name: "BABASAHEB GANGADHAR KAKDE", admissions: ["42"] }
    ],
    grade3: [
        { phone: "9923149457", name: "Aniruddha Babasaheb Ekhande", admissions: ["43"] },
        { phone: "9306505119", name: "Sunil Ramkishan Kumar", admissions: ["44"] },
        { phone: "9545467759", name: "Narayan Pandurang Chand", admissions: ["45"] },
        { phone: "7774005393", name: "Ram Vithoba Dhakne", admissions: ["46", "71"] }, // Multiple children same grade
        { phone: "9921777645", name: "Ganesh Dyandev Kakde", admissions: ["47"] },
        { phone: "9975551975", name: "Laxman Rushishankar Mujmule", admissions: ["48"] },
        { phone: "7020200121", name: "Rajendra Nandkishor Baginwal", admissions: ["49"] },
        { phone: "9529339691", name: "Sunil Harishchandra Jadhav", admissions: ["50"] },
        { phone: "9423337937", name: "Sham Sandipan Mogarge", admissions: ["51"] },
        { phone: "9156541968", name: "Yogesh Shrimant Pungle", admissions: ["52"] },
        { phone: "9881252614", name: "Satish Ramchandra Pawar", admissions: ["53"] },
        { phone: "8329196665", name: "Prakash Upendra Singh", admissions: ["54"] },
        { phone: "7542075952", name: "Krishna murmu", admissions: ["55"] },
        { phone: "9975413265", name: "Mahendra Sukhlal Pawar", admissions: ["56"] },
        { phone: "7020579408", name: "Pushparaj Devidas Dhawale", admissions: ["57"] },
        { phone: "9158190100", name: "Raghunath Kautikrao Sahane", admissions: ["58"] }, // DUPLICATE from Grade 1
        { phone: "8830747008", name: "Vijay Thombre", admissions: ["59"] },
        { phone: "9975008577", name: "Shaikh Shakil Shaikh Gaffar", admissions: ["60"] },
        { phone: "8208888028", name: "Eknatha karbhari korde", admissions: ["61"] },
        { phone: "7972580881", name: "Ganesh bapusaheb Naikwade", admissions: ["62"] },
        { phone: "9823480909", name: "Gajanan Hanumantrao Vyavahare", admissions: ["63"] },
        { phone: "8855921766", name: "Ravindra Kachru Jadhav", admissions: ["64"] },
        { phone: "8208731050", name: "Shivaji Jagannath Chavan", admissions: ["65"] },
        { phone: "7526977034", name: "Karan Dadarao Tambe", admissions: ["66"] },
        { phone: "8698495054", name: "Ankush Rambhau Ahinde", admissions: ["67"] },
        { phone: "9552164689", name: "Vikas Rampravesh Patel", admissions: ["68"] },
        { phone: "9822652355", name: "Vilas Arvind Jaybhaye", admissions: ["69"] },
        { phone: "9923092111", name: "Vikas Gangaram Shinde", admissions: ["70"] },
        { phone: "9860851214", name: "Ganesh Pandurang Wagh", admissions: ["72"] },
        { phone: "9673437699", name: "Akhil Shaikh", admissions: ["73"] }
    ]
    // Add other grades...
};

function analyzeAllDuplicates() {
    console.log("=== COMPLETE DUPLICATE PARENT ANALYSIS ===\n");

    const grade1Phones = allGradeParents.grade1.map(p => p.phone);
    const duplicateMap = new Map();
    const newParentsMap = new Map();

    // Build complete picture of all parents
    Object.keys(allGradeParents).forEach(grade => {
        allGradeParents[grade].forEach(parent => {
            const key = parent.phone;

            if (!duplicateMap.has(key)) {
                duplicateMap.set(key, {
                    phone: parent.phone,
                    name: parent.name,
                    grades: [],
                    allAdmissions: []
                });
            }

            const entry = duplicateMap.get(key);
            entry.grades.push(grade);
            entry.allAdmissions.push(...parent.admissions);
        });
    });

    // Identify true duplicates (appear in multiple grades)
    const trueDuplicates = [];
    const singleGradeParents = [];

    duplicateMap.forEach((parent, phone) => {
        if (parent.grades.length > 1) {
            trueDuplicates.push(parent);
            console.log(`🔥 MULTI-GRADE PARENT: ${parent.name} (${phone})`);
            console.log(`   Grades: ${parent.grades.join(', ')}`);
            console.log(`   Children: ${parent.allAdmissions.join(', ')}`);
            console.log('');
        } else {
            singleGradeParents.push(parent);
        }
    });

    console.log(`\n=== SUMMARY ===`);
    console.log(`Parents appearing in multiple grades: ${trueDuplicates.length}`);
    console.log(`Parents in single grade only: ${singleGradeParents.length}`);
    console.log(`Total unique parents across all grades: ${duplicateMap.size}`);

    return { trueDuplicates, singleGradeParents, duplicateMap };
}

// Run analysis
const analysis = analyzeAllDuplicates();

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { allGradeParents, analyzeAllDuplicates };
}
