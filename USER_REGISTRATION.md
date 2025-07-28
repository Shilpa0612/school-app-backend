# User Registration Guide

## Overview
This document outlines the registration process for different user roles in the School App system. The system supports four roles:
- Admin
- Principal
- Teacher
- Parent

## Role-Specific Registration Process

### 1. Admin Registration
Admin accounts can only be created by another admin or through direct database insertion during system setup.

```http
POST /api/auth/register
```
```json
{
    "phone_number": "1234567890",
    "password": "secure_password",
    "role": "admin",
    "full_name": "Admin Name",
    "email": "admin@school.com"
}
```
**Note:** The first admin account should be created during system initialization.

### 2. Principal Registration
Principal accounts can only be created by an admin.

```http
POST /api/auth/register
```
```json
{
    "phone_number": "1234567890",
    "password": "secure_password",
    "role": "principal",
    "full_name": "Principal Name",
    "email": "principal@school.com"
}
```
**Required Headers:**
- `Authorization: Bearer <admin_token>`

### 3. Teacher Registration
Teacher accounts can be created by either admin or principal.

```http
POST /api/auth/register
```
```json
{
    "phone_number": "1234567890",
    "password": "secure_password",
    "role": "teacher",
    "full_name": "Teacher Name",
    "email": "teacher@school.com",
    "subjects": ["Mathematics", "Physics"],
    "class_assigned": "UUID_of_class" // Optional
}
```
**Required Headers:**
- `Authorization: Bearer <admin_or_principal_token>`

### 4. Parent Registration
Parents can self-register but need to be verified against the student database.

```http
POST /api/auth/register
```
```json
{
    "phone_number": "1234567890",
    "password": "secure_password",
    "role": "parent",
    "full_name": "Parent Name",
    "email": "parent@example.com"
}
```

## Parent-Child Linking Process

### 1. Single Parent Registration

After successful parent registration, link children using:

```http
POST /api/parent-student/link
```
```json
{
    "student_details": [
        {
            "admission_number": "ADM123",
            "student_name": "Student Name",
            "relationship": "father",
            "is_primary_guardian": true
        }
    ]
}
```

### 2. Multiple Parents Registration (Both Parents)

#### First Parent Registration
Follow the normal parent registration process and link child:

```http
POST /api/parent-student/link
```
```json
{
    "student_details": [
        {
            "admission_number": "ADM123",
            "student_name": "Student Name",
            "relationship": "father",
            "is_primary_guardian": true
        }
    ]
}
```

#### Second Parent Registration
The second parent can register and link to the same child using:

```http
POST /api/parent-student/link
```
```json
{
    "student_details": [
        {
            "admission_number": "ADM123",
            "student_name": "Student Name",
            "relationship": "mother",
            "is_primary_guardian": false
        }
    ]
}
```

### 3. Multiple Children
Parents can link multiple children to their account:

```http
POST /api/parent-student/link
```
```json
{
    "student_details": [
        {
            "admission_number": "ADM123",
            "student_name": "First Child Name",
            "relationship": "father",
            "is_primary_guardian": true
        },
        {
            "admission_number": "ADM124",
            "student_name": "Second Child Name",
            "relationship": "father",
            "is_primary_guardian": true
        }
    ]
}
```

## Verification Process

### Student Verification
1. The system verifies the provided admission number against the student database
2. Checks if the student name matches the admission number
3. Verifies if the student is currently enrolled

### Parent Verification
1. For the first parent:
   - Creates a new parent-student mapping
   - Sets the specified guardian status
2. For the second parent:
   - Verifies if another parent is already linked
   - Creates additional parent-student mapping
   - Updates guardian relationships accordingly

## Database Schema for Parent-Student Mapping

```sql
parent_student_mappings
- id (uuid, primary key)
- parent_id (uuid, foreign key to users table)
- student_id (uuid, foreign key to students table)
- relationship (string: father/mother/guardian)
- is_primary_guardian (boolean)
- created_at (timestamp)
- updated_at (timestamp)
```

## Error Handling

### Common Error Scenarios

1. **Student Not Found**
```json
{
    "status": "error",
    "message": "Student with admission number ADM123 not found"
}
```

2. **Invalid Relationship**
```json
{
    "status": "error",
    "message": "Invalid relationship type. Must be one of: father, mother, guardian"
}
```

3. **Already Primary Guardian**
```json
{
    "status": "error",
    "message": "Student already has a primary guardian"
}
```

4. **Duplicate Registration**
```json
{
    "status": "error",
    "message": "This parent-student relationship already exists"
}
```

## Best Practices

1. **Primary Guardian:**
   - Each student should have exactly one primary guardian
   - Additional parents/guardians can be linked with `is_primary_guardian: false`

2. **Verification:**
   - Always verify student details before linking
   - Ensure phone numbers are unique per user
   - Validate relationships and guardian status

3. **Updates:**
   - Allow updating relationship status
   - Allow transferring primary guardian status
   - Maintain history of changes

4. **Security:**
   - Require additional verification for primary guardian changes
   - Implement rate limiting for registration attempts
   - Add phone number verification

## Implementation Example

### Parent Registration Flow

1. Parent registers with basic details
2. Receives OTP for phone verification
3. Verifies phone number
4. Links children using admission numbers
5. System verifies student details
6. Creates parent-student mappings
7. Sends notification to existing guardians (if any)

### Code Example for Parent-Student Linking

```javascript
// Verify student exists
const { data: student } = await supabase
    .from('students')
    .select('id, full_name')
    .eq('admission_number', admissionNumber)
    .single();

if (!student) {
    throw new Error('Student not found');
}

// Check existing guardians
const { data: existingGuardian } = await supabase
    .from('parent_student_mappings')
    .select('parent_id, is_primary_guardian')
    .eq('student_id', student.id)
    .eq('is_primary_guardian', true)
    .single();

// Create mapping
await supabase
    .from('parent_student_mappings')
    .insert([
        {
            parent_id: currentUserId,
            student_id: student.id,
            relationship: relationship,
            is_primary_guardian: !existingGuardian
        }
    ]);
``` 