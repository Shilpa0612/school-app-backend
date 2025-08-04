# Parent Registration Workflow

## Overview

The School App now supports a two-step parent registration process:

1. **Admin/Principal creates parent record** (without password)
2. **Parent self-registers** with phone number and password

This approach ensures proper verification of parent-student relationships while allowing parents to set their own passwords.

## Workflow Steps

### Step 1: Admin/Principal Creates Parent Record

**Endpoint:** `POST /api/auth/create-parent`

**Purpose:** Create parent record and link to students

**Required Fields:**

- `full_name`: Parent's full name
- `phone_number`: 10-digit phone number
- `email`: Optional email address
- `student_details`: Array of student information

**Example Request:**

```json
{
  "full_name": "John Smith",
  "phone_number": "1234567890",
  "email": "john.smith@example.com",
  "student_details": [
    {
      "admission_number": "ADM2024001",
      "relationship": "father",
      "is_primary_guardian": true
    },
    {
      "admission_number": "ADM2024002",
      "relationship": "father",
      "is_primary_guardian": false
    }
  ]
}
```

**Validation Rules:**

- Phone number must be 10 digits
- All students must exist in the database
- Only one student can have this parent as primary guardian
- Relationship must be 'father', 'mother', or 'guardian'

**Response:**

```json
{
  "status": "success",
  "data": {
    "parent": {
      "id": "uuid",
      "full_name": "John Smith",
      "phone_number": "1234567890",
      "email": "john.smith@example.com",
      "role": "parent",
      "is_registered": false
    },
    "students": [
      {
        "id": "uuid",
        "admission_number": "ADM2024001",
        "full_name": "Alice Smith"
      },
      {
        "id": "uuid",
        "admission_number": "ADM2024002",
        "full_name": "Bob Smith"
      }
    ],
    "mappings": [
      {
        "relationship": "father",
        "is_primary_guardian": true,
        "access_level": "full"
      },
      {
        "relationship": "father",
        "is_primary_guardian": false,
        "access_level": "full"
      }
    ],
    "registration_instructions": {
      "message": "Parent can now register using their phone number",
      "endpoint": "POST /api/auth/register",
      "required_fields": ["phone_number", "password", "role: \"parent\""]
    }
  },
  "message": "Parent record created successfully. Parent can now register using their phone number."
}
```

### Step 2: Parent Self-Registration

**Endpoint:** `POST /api/auth/register`

**Purpose:** Parent completes registration with password

**Required Fields:**

- `phone_number`: Must match the phone number from Step 1
- `password`: Minimum 6 characters
- `role`: Must be "parent"
- `full_name`: Optional (will use existing name if not provided)

**Example Request:**

```json
{
  "phone_number": "1234567890",
  "password": "MySecurePassword123",
  "role": "parent",
  "full_name": "John Smith"
}
```

**Response:**

```json
{
  "status": "success",
  "data": {
    "user": {
      "id": "uuid",
      "phone_number": "1234567890",
      "role": "parent",
      "full_name": "John Smith"
    },
    "token": "jwt_token_here",
    "message": "Parent registration completed successfully"
  }
}
```

## Error Scenarios

### 1. Parent Already Exists and Registered

**Error:** `User already exists and is registered`

**Solution:** Parent should use login endpoint instead

### 2. Student Not Found

**Error:** `Students not found: ADM123, ADM124`

**Solution:** Verify admission numbers exist in database

### 3. Multiple Primary Guardians

**Error:** `Only one student can have this parent as primary guardian`

**Solution:** Ensure only one student has `is_primary_guardian: true`

### 4. Invalid Phone Number

**Error:** `Invalid phone number format`

**Solution:** Ensure phone number is exactly 10 digits

## Database Schema Changes

### Users Table

Added `is_registered` column:

```sql
ALTER TABLE public.users
ADD COLUMN is_registered BOOLEAN DEFAULT true;
```

**Purpose:** Tracks whether a parent has completed their registration

**Values:**

- `true`: User has password and can login
- `false`: Parent record exists but no password set

## Security Features

### 1. Role-Based Access

- Only Admin/Principal can create parent records
- Parents can only register themselves

### 2. Student Verification

- All students must exist in database
- Admission numbers are validated

### 3. Primary Guardian Validation

- Only one primary guardian per student
- Prevents conflicts in parent-student relationships

### 4. Phone Number Uniqueness

- Each phone number can only be used once
- Prevents duplicate accounts

## Benefits

### 1. **Verified Relationships**

- Admin/Principal verifies parent-student relationships
- Ensures data integrity

### 2. **Self-Service Registration**

- Parents set their own passwords
- No password sharing or security risks

### 3. **Flexible Workflow**

- Supports single and multiple children
- Handles multiple parents per child

### 4. **Audit Trail**

- Clear separation between record creation and registration
- Tracks registration status

## Usage Examples

### Single Child Registration

```bash
# Step 1: Admin creates parent record
curl -X POST /api/auth/create-parent \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "Jane Doe",
    "phone_number": "9876543210",
    "student_details": [{
      "admission_number": "ADM2024001",
      "relationship": "mother",
      "is_primary_guardian": true
    }]
  }'

# Step 2: Parent registers
curl -X POST /api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "9876543210",
    "password": "MyPassword123",
    "role": "parent"
  }'
```

### Multiple Children Registration

```bash
# Step 1: Admin creates parent record for multiple children
curl -X POST /api/auth/create-parent \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "John Smith",
    "phone_number": "1234567890",
    "student_details": [
      {
        "admission_number": "ADM2024001",
        "relationship": "father",
        "is_primary_guardian": true
      },
      {
        "admission_number": "ADM2024002",
        "relationship": "father",
        "is_primary_guardian": false
      }
    ]
  }'

# Step 2: Parent registers (same as single child)
curl -X POST /api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "1234567890",
    "password": "MyPassword123",
    "role": "parent"
  }'
```

## Migration Notes

### For Existing Systems

1. **Run Database Migration:**

   ```sql
   -- Execute ADD_IS_REGISTERED_COLUMN.sql
   ```

2. **Update Existing Users:**

   ```sql
   UPDATE public.users SET is_registered = true;
   ```

3. **Test New Workflow:**
   - Create test parent records
   - Verify parent self-registration
   - Test error scenarios

### Backward Compatibility

- Existing users remain unaffected
- All existing endpoints continue to work
- New workflow is additive, not replacing

## Troubleshooting

### Common Issues

1. **Parent can't register after record creation**
   - Check if `is_registered` is `false` in database
   - Verify phone number matches exactly

2. **Student not found error**
   - Verify admission numbers exist in `students_master` table
   - Check for typos in admission numbers

3. **Primary guardian conflict**
   - Ensure only one student per parent has `is_primary_guardian: true`
   - Check existing parent-student mappings

### Debug Queries

```sql
-- Check parent registration status
SELECT id, full_name, phone_number, is_registered
FROM users
WHERE role = 'parent';

-- Check parent-student mappings
SELECT psm.*, u.full_name as parent_name, sm.full_name as student_name
FROM parent_student_mappings psm
JOIN users u ON psm.parent_id = u.id
JOIN students_master sm ON psm.student_id = sm.id;
```
