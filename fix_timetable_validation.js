const fs = require('fs');
const path = require('path');

// Read the timetable.js file
const filePath = path.join(__dirname, 'src', 'routes', 'timetable.js');
let content = fs.readFileSync(filePath, 'utf8');

// Replace all instances of .single() with array handling
// Pattern 1: Create/Post entries
content = content.replace(
    /const \{ data: assignment, error \} = await adminSupabase\s*\.from\(tableName\)\s*\.select\('id'\)\s*\.eq\('teacher_id', req\.user\.id\)\s*\.eq\('class_division_id', class_division_id\)\s*\.eq\('is_active', true\)\s*\.single\(\);/g,
    `const { data: assignments, error } = await adminSupabase
                            .from(tableName)
                            .select('id')
                            .eq('teacher_id', req.user.id)
                            .eq('class_division_id', class_division_id)
                            .eq('is_active', true);`
);

content = content.replace(
    /logger\.info\(`Table \$\{tableName\} check result:`, \{ assignment, error \}\);/g,
    `logger.info(\`Table \${tableName} check result:\`, { assignments, error });`
);

content = content.replace(
    /if \(assignment\) \{/g,
    `if (assignments && assignments.length > 0) {`
);

content = content.replace(
    /teacherAssignment = assignment;/g,
    `teacherAssignment = assignments[0]; // Take first assignment`
);

// Pattern 2: Update entries (existingEntry.class_division_id)
content = content.replace(
    /const \{ data: assignment, error \} = await adminSupabase\s*\.from\(tableName\)\s*\.select\('id'\)\s*\.eq\('teacher_id', req\.user\.id\)\s*\.eq\('class_division_id', existingEntry\.class_division_id\)\s*\.eq\('is_active', true\)\s*\.single\(\);/g,
    `const { data: assignments, error } = await adminSupabase
                            .from(tableName)
                            .select('id')
                            .eq('teacher_id', req.user.id)
                            .eq('class_division_id', existingEntry.class_division_id)
                            .eq('is_active', true);`
);

// Write the updated content back
fs.writeFileSync(filePath, content, 'utf8');

console.log('✅ Fixed all timetable validation functions!');
console.log('Changed .single() to array handling for multiple teacher assignments');
