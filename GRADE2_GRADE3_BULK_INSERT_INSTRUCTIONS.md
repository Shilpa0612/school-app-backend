# Grade 2 & Grade 3 Bulk Insert Instructions

This guide provides step-by-step instructions to bulk insert Grade 2 and Grade 3 students and their parents into the school management system.

## Files Created

### Grade 2 Files

1. **`bulk_grade2_students_payload.json`** - Contains 21 Grade 2 students for bulk insertion
2. **`bulk_grade2_parents_payload.json`** - Contains 21 Grade 2 parents for bulk insertion

### Grade 3 Files

3. **`bulk_grade3_students_payload.json`** - Contains 31 Grade 3 students for bulk insertion
4. **`bulk_grade3_parents_payload.json`** - Contains 30 Grade 3 parents for bulk insertion (Ram Vithoba Dhakne has 2 children)

## Step-by-Step Process

### Step 1: Create Grade 2 Students

**Endpoint:** `POST /api/academic/bulk-students`

**Headers:**

```
Content-Type: application/json
Authorization: Bearer <your-auth-token>
```

**Payload:** Use the contents of `bulk_grade2_students_payload.json`

**cURL Example:**

```bash
curl -X POST http://localhost:3000/api/academic/bulk-students \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d @bulk_grade2_students_payload.json
```

### Step 2: Create Grade 2 Parents

**Endpoint:** `POST /api/auth/bulk-create-parents`

**Headers:**

```
Content-Type: application/json
Authorization: Bearer <your-auth-token>
```

**Payload:** Use the contents of `bulk_grade2_parents_payload.json`

**cURL Example:**

```bash
curl -X POST http://localhost:3000/api/auth/bulk-create-parents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d @bulk_grade2_parents_payload.json
```

### Step 3: Create Grade 3 Students

**Endpoint:** `POST /api/academic/bulk-students`

**Payload:** Use the contents of `bulk_grade3_students_payload.json`

**cURL Example:**

```bash
curl -X POST http://localhost:3000/api/academic/bulk-students \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d @bulk_grade3_students_payload.json
```

### Step 4: Create Grade 3 Parents

**Endpoint:** `POST /api/auth/bulk-create-parents`

**Payload:** Use the contents of `bulk_grade3_parents_payload.json`

**cURL Example:**

```bash
curl -X POST http://localhost:3000/api/auth/bulk-create-parents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d @bulk_grade3_parents_payload.json
```

## Data Summary

### Grade 2 (Class Level ID: e263d6c8-2108-48a5-968b-48b0df2c4fc2)

- **Division ID:** `8a15bee2-8717-4755-982d-522016e0b51c` (Grade 2, Division A)
- **Total Students:** 21
- **Total Parents:** 21
- **Admission Numbers:** 22-42
- **Roll Numbers:** 1-21
- **Admission Date:** 2025-01-01

### Grade 3 (Class Level ID: ab970f08-faa9-46e2-a1ae-9c4ba2556014)

- **Division ID:** `c78f80f5-5a4a-428b-915d-fb076b7271b0` (Grade 3, Division A)
- **Total Students:** 31
- **Total Parents:** 30 (Ram Vithoba Dhakne has 2 children: admission numbers 46 & 71)
- **Admission Numbers:** 43-73
- **Roll Numbers:** 1-32
- **Admission Date:** 2025-01-01

## Important Notes

### Prerequisites

- Ensure both class divisions exist in your database:
  - Grade 2 Division A: `8a15bee2-8717-4755-982d-522016e0b51c`
  - Grade 3 Division A: `c78f80f5-5a4a-428b-915d-fb076b7271b0`
- Have admin or principal authentication token ready
- Academic year should be properly set up

### Order of Operations

1. **MUST create students first** before creating parents
2. Parents are linked to students using admission numbers
3. Complete Grade 2 (students → parents) before starting Grade 3
4. If any step fails, fix the issue before proceeding

### Data Validation

- All phone numbers validated for Indian mobile format
- Dates in ISO format (YYYY-MM-DD)
- Gender values: "male" or "female" (lowercase)
- Admission numbers must be unique across the entire school

### Special Cases

- **Ram Vithoba Dhakne (7774005393)** appears twice in Grade 3 data:
  - Child 1: Dhanashri Ram Dhakne (admission #46) - Primary guardian
  - Child 2: Yashashri Ram Dhakne (admission #71) - Secondary guardian
- **Ishwar Sominath Teple (937054)** - Phone number appears incomplete, verify if valid
- **Duplicate Parent Check:** Baliram Babanrao Choudhari (9890109143) appears in both Grade 1 and Grade 2 - handle carefully

### Parent Login Credentials

All parents are created with:

- **Initial Password:** `Temp@1234`
- **Auto-registration:** Parents can login immediately with phone number + initial password
- **First login:** System automatically converts initial password to permanent password

## Expected Responses

### Successful Student Creation

```json
{
  "status": "success",
  "message": "Successfully created X students",
  "data": {
    "created_count": X,
    "students": [...],
    "academic_records": [...],
    "summary": {
      "admission_numbers": [...],
      "class_divisions": [...]
    }
  }
}
```

### Successful Parent Creation

```json
{
  "status": "success",
  "message": "Successfully created X parents with student linkages",
  "data": {
    "created_count": X,
    "parents": [...],
    "student_linkages": [...]
  }
}
```

## Troubleshooting

### Common Issues

1. **Authentication Error (401):** Verify auth token and permissions
2. **Class Division Not Found (404):** Check division IDs exist in database
3. **Duplicate Admission Number (400):** Ensure admission numbers are unique
4. **Invalid Phone Number (400):** Validate all phone numbers
5. **Gender Constraint Violation (23514):** Ensure gender values are lowercase

### Verification Queries

After insertion, verify data using:

```bash
# Grade 2 students
GET /api/academic/class-divisions/8a15bee2-8717-4755-982d-522016e0b51c/students

# Grade 3 students
GET /api/academic/class-divisions/c78f80f5-5a4a-428b-915d-fb076b7271b0/students
```

### Parent Login Testing

Test parent login with any created parent:

```bash
POST /api/auth/login
{
  "phone_number": "7709881063",
  "password": "Temp@1234"
}
```

## Summary Statistics

- **Total Students:** 52 (21 Grade 2 + 31 Grade 3)
- **Total Parents:** 51 (21 Grade 2 + 30 Grade 3)
- **Admission Numbers:** 22-73
- **All parents can login immediately with:** Phone + `Temp@1234`

## Support

If you encounter issues during bulk insertion:

1. Check server logs for detailed error messages
2. Verify all prerequisites are met
3. Ensure proper order of operations (students before parents)
4. Handle duplicate parent phone numbers appropriately
