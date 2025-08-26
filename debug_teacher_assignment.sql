-- Debug Teacher Assignment Issues
-- Replace 'YOUR_TEACHER_ID' with the actual teacher's user ID
-- Replace 'd5e2c45b-bce9-45c2-bb4e-caa6add083e1' with the class division ID from the error

-- 1. Check if the class division exists
SELECT 
    id,
    division,
    teacher_id as legacy_teacher_id,
    academic_year_id,
    class_level_id,
    created_at
FROM class_divisions 
WHERE id = 'd5e2c45b-bce9-45c2-bb4e-caa6add083e1';

-- 2. Check all teacher assignments for this class
SELECT 
    cta.id,
    cta.teacher_id,
    cta.class_division_id,
    cta.assignment_type,
    cta.subject,
    cta.is_primary,
    cta.is_active,
    cta.assigned_by,
    cta.created_at,
    u.full_name as teacher_name,
    u.role as teacher_role
FROM class_teacher_assignments cta
JOIN users u ON cta.teacher_id = u.id
WHERE cta.class_division_id = 'd5e2c45b-bce9-45c2-bb4e-caa6add083e1'
ORDER BY cta.is_active DESC, cta.created_at DESC;

-- 3. Check if specific teacher is assigned to this class
SELECT 
    cta.id,
    cta.teacher_id,
    cta.class_division_id,
    cta.assignment_type,
    cta.subject,
    cta.is_primary,
    cta.is_active,
    cta.assigned_by,
    cta.created_at,
    u.full_name as teacher_name,
    u.role as teacher_role
FROM class_teacher_assignments cta
JOIN users u ON cta.teacher_id = u.id
WHERE cta.teacher_id = 'YOUR_TEACHER_ID' 
AND cta.class_division_id = 'd5e2c45b-bce9-45c2-bb4e-caa6add083e1'
AND cta.is_active = true;

-- 4. Check all assignments for the specific teacher
SELECT 
    cta.id,
    cta.teacher_id,
    cta.class_division_id,
    cta.assignment_type,
    cta.subject,
    cta.is_primary,
    cta.is_active,
    cta.assigned_by,
    cta.created_at,
    cd.division,
    cl.name as class_level,
    u.full_name as teacher_name
FROM class_teacher_assignments cta
JOIN class_divisions cd ON cta.class_division_id = cd.id
JOIN class_levels cl ON cd.class_level_id = cl.id
JOIN users u ON cta.teacher_id = u.id
WHERE cta.teacher_id = 'YOUR_TEACHER_ID'
ORDER BY cta.is_active DESC, cta.created_at DESC;

-- 5. Check legacy assignment (if any)
SELECT 
    id,
    division,
    teacher_id,
    academic_year_id,
    class_level_id,
    created_at
FROM class_divisions 
WHERE id = 'd5e2c45b-bce9-45c2-bb4e-caa6add083e1' 
AND teacher_id = 'YOUR_TEACHER_ID';

-- 6. Check if teacher exists and has correct role
SELECT 
    id,
    full_name,
    phone_number,
    email,
    role,
    is_active,
    created_at
FROM users 
WHERE id = 'YOUR_TEACHER_ID';

-- 7. Check class details with level and year info
SELECT 
    cd.id,
    cd.division,
    cd.teacher_id as legacy_teacher_id,
    cl.name as class_level,
    ay.year_name as academic_year,
    cd.created_at
FROM class_divisions cd
JOIN class_levels cl ON cd.class_level_id = cl.id
JOIN academic_years ay ON cd.academic_year_id = ay.id
WHERE cd.id = 'd5e2c45b-bce9-45c2-bb4e-caa6add083e1';

-- 8. Check for any inactive assignments for this teacher-class combination
SELECT 
    cta.id,
    cta.teacher_id,
    cta.class_division_id,
    cta.assignment_type,
    cta.subject,
    cta.is_primary,
    cta.is_active,
    cta.assigned_by,
    cta.created_at,
    cta.updated_at
FROM class_teacher_assignments cta
WHERE cta.teacher_id = 'YOUR_TEACHER_ID' 
AND cta.class_division_id = 'd5e2c45b-bce9-45c2-bb4e-caa6add083e1';

-- 9. Check recent teacher assignments (last 10)
SELECT 
    cta.id,
    cta.teacher_id,
    cta.class_division_id,
    cta.assignment_type,
    cta.subject,
    cta.is_primary,
    cta.is_active,
    cta.assigned_by,
    cta.created_at,
    u.full_name as teacher_name,
    cd.division,
    cl.name as class_level
FROM class_teacher_assignments cta
JOIN users u ON cta.teacher_id = u.id
JOIN class_divisions cd ON cta.class_division_id = cd.id
JOIN class_levels cl ON cd.class_level_id = cl.id
WHERE cta.teacher_id = 'YOUR_TEACHER_ID'
ORDER BY cta.created_at DESC
LIMIT 10;

-- 10. Check if there are any duplicate assignments
SELECT 
    teacher_id,
    class_division_id,
    assignment_type,
    COUNT(*) as assignment_count,
    STRING_AGG(id::text, ', ') as assignment_ids
FROM class_teacher_assignments
WHERE teacher_id = 'YOUR_TEACHER_ID' 
AND class_division_id = 'd5e2c45b-bce9-45c2-bb4e-caa6add083e1'
GROUP BY teacher_id, class_division_id, assignment_type
HAVING COUNT(*) > 1;
