import fs from 'fs';

const filePath = './src/routes/attendance.js';

try {
    // Read the file
    let content = fs.readFileSync(filePath, 'utf8');

    // Replace all supabase. with adminSupabase.
    content = content.replace(/supabase\./g, 'adminSupabase.');

    // Write back to file
    fs.writeFileSync(filePath, content, 'utf8');

    console.log('✅ Successfully replaced all supabase calls with adminSupabase calls');
    console.log('📁 File updated: ' + filePath);

} catch (error) {
    console.error('❌ Error fixing attendance.js:', error.message);
}
