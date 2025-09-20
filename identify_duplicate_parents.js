/**
 * Script to identify duplicate parents across all grades
 * This will help create modified payloads that avoid duplicate parent creation
 */

// Grade 1 parents (already created in database)
const grade1Parents = [
    "9404002011", // Roshan Eknath Parmeshwar
    "8208551468", // Raushan Umesh Prasad Singh
    "8459514318", // Kishor Bhanudas Tirukhe
    "9588605473", // Shaikh Musa
    "9420818888", // Prashant Madhavrao Pawar
    "8770048722", // Vipin kumar mishra
    "8149260449", // Pratik Prabhakar Pise
    "7350969503", // Manoj Gopikishan Agrawal
    "7218594090", // Shru Khan
    "8087478036", // Amit
    "9158190100", // Raghunath kautikrao Sahane
    "9970045740", // Sachin Babanrao Shinde
    "9890109143", // Baliram Babanrao Choudhari
    "9028008020", // Punit Nirmal Jogad
    "8484003111", // Dnyaneshwar Patilba Bhusare
    "9158759550", // Chetan Bharat Rathod
    "8830069989", // Anit Rai
    "9922436652", // Kakasaheb ramro Jamkar
    "9226288465", // Ashok Chandrakant Gavali
    "8208123943"  // Mahavir Ramjivan Gaud
];

// All parents from other grades with their details
const allParents = {
    grade2: [
        { phone: "7709881063", name: "Babasaheb Tejrao Jadhav", admission: "22" },
        { phone: "9975309600", name: "Deepak Kanhaiya Lal Verma", admission: "23" },
        { phone: "7972556161", name: "Radhesham Kashinath Teple", admission: "24" },
        { phone: "8668428522", name: "Subhash Ramnath Dhayde", admission: "25" },
        { phone: "8142629034", name: "Dinesh Yadav", admission: "26" },
        { phone: "9595963444", name: "Shailendra Janardhan Kshirsagar", admission: "27" },
        { phone: "9552009914", name: "Sameer Hakeem Dange", admission: "28" },
        { phone: "9404277377", name: "Govind Laxman Mule", admission: "29" },
        { phone: "7058865799", name: "Haridas Vinayak Mandve", admission: "30" },
        { phone: "9764642103", name: "Balasaheb prahlad randhe", admission: "31" },
        { phone: "7385047800", name: "Narayan Kundlikrao Kakde", admission: "32" },
        { phone: "8999003655", name: "Kunal babanrao varade", admission: "33" },
        { phone: "9890109143", name: "Baliram Babanrao Choudhari", admission: "34" }, // DUPLICATE
        { phone: "9766709708", name: "NITISH PANDIRANG UPADHYE", admission: "35" },
        { phone: "9673774754", name: "Ishwar Rameshrao Raut", admission: "36" },
        { phone: "9511716111", name: "Mahesh Machindra Dawkhar", admission: "37" },
        { phone: "7822007544", name: "Shivhari Shankar Gutte", admission: "38" },
        { phone: "9922939991", name: "Sunil Subhash Soni", admission: "39" },
        { phone: "937054", name: "Ishwar Sominath Teple", admission: "40" },
        { phone: "8484952644", name: "Anil Saluba Misal", admission: "41" },
        { phone: "9503314033", name: "BABASAHEB GANGADHAR KAKDE", admission: "42" }
    ],
    grade3: [
        { phone: "9923149457", name: "Aniruddha Babasaheb Ekhande", admission: "43" },
        { phone: "9306505119", name: "Sunil Ramkishan Kumar", admission: "44" },
        { phone: "9545467759", name: "Narayan Pandurang Chand", admission: "45" },
        { phone: "7774005393", name: "Ram Vithoba Dhakne", admission: "46,71" }, // Multiple children
        { phone: "9921777645", name: "Ganesh Dyandev Kakde", admission: "47" },
        { phone: "9975551975", name: "Laxman Rushishankar Mujmule", admission: "48" },
        { phone: "7020200121", name: "Rajendra Nandkishor Baginwal", admission: "49" },
        { phone: "9529339691", name: "Sunil Harishchandra Jadhav", admission: "50" },
        { phone: "9423337937", name: "Sham Sandipan Mogarge", admission: "51" },
        { phone: "9156541968", name: "Yogesh Shrimant Pungle", admission: "52" },
        { phone: "9881252614", name: "Satish Ramchandra Pawar", admission: "53" },
        { phone: "8329196665", name: "Prakash Upendra Singh", admission: "54" },
        { phone: "7542075952", name: "Krishna murmu", admission: "55" },
        { phone: "9975413265", name: "Mahendra Sukhlal Pawar", admission: "56" },
        { phone: "7020579408", name: "Pushparaj Devidas Dhawale", admission: "57" },
        { phone: "9158190100", name: "Raghunath Kautikrao Sahane", admission: "58" }, // DUPLICATE
        { phone: "8830747008", name: "Vijay Thombre", admission: "59" },
        { phone: "9975008577", name: "Shaikh Shakil Shaikh Gaffar", admission: "60" },
        { phone: "8208888028", name: "Eknatha karbhari korde", admission: "61" },
        { phone: "7972580881", name: "Ganesh bapusaheb Naikwade", admission: "62" },
        { phone: "9823480909", name: "Gajanan Hanumantrao Vyavahare", admission: "63" },
        { phone: "8855921766", name: "Ravindra Kachru Jadhav", admission: "64" },
        { phone: "8208731050", name: "Shivaji Jagannath Chavan", admission: "65" },
        { phone: "7526977034", name: "Karan Dadarao Tambe", admission: "66" },
        { phone: "8698495054", name: "Ankush Rambhau Ahinde", admission: "67" },
        { phone: "9552164689", name: "Vikas Rampravesh Patel", admission: "68" },
        { phone: "9822652355", name: "Vilas Arvind Jaybhaye", admission: "69" },
        { phone: "9923092111", name: "Vikas Gangaram Shinde", admission: "70" },
        { phone: "9860851214", name: "Ganesh Pandurang Wagh", admission: "72" },
        { phone: "9673437699", name: "Akhil Shaikh", admission: "73" }
    ]
    // Add other grades here...
};

function identifyDuplicates() {
    console.log("=== DUPLICATE PARENT ANALYSIS ===\n");
    
    const duplicates = [];
    const newParents = [];
    
    // Check each grade
    Object.keys(allParents).forEach(grade => {
        console.log(`\n--- ${grade.toUpperCase()} ---`);
        
        allParents[grade].forEach(parent => {
            if (grade1Parents.includes(parent.phone)) {
                duplicates.push({
                    grade,
                    phone: parent.phone,
                    name: parent.name,
                    admission: parent.admission,
                    action: "LINK_TO_EXISTING_PARENT"
                });
                console.log(`🔗 DUPLICATE: ${parent.name} (${parent.phone}) - admission ${parent.admission}`);
            } else {
                newParents.push({
                    grade,
                    phone: parent.phone,
                    name: parent.name,
                    admission: parent.admission,
                    action: "CREATE_NEW_PARENT"
                });
                console.log(`✅ NEW: ${parent.name} (${parent.phone}) - admission ${parent.admission}`);
            }
        });
    });
    
    console.log(`\n=== SUMMARY ===`);
    console.log(`Total duplicates found: ${duplicates.length}`);
    console.log(`Total new parents: ${newParents.length}`);
    
    return { duplicates, newParents };
}

// Run the analysis
const result = identifyDuplicates();

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { grade1Parents, allParents, identifyDuplicates };
}
