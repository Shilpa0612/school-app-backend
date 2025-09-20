# Grade 1 Bulk Insert Instructions

This guide provides step-by-step instructions to bulk insert 20 Grade 1 students and their parents into the school management system.

## Files Created

1. **`bulk_grade1_students_payload.json`** - Contains student data for bulk insertion
2. **`bulk_grade1_parents_payload.json`** - Contains parent data for bulk insertion
3. **`GRADE1_BULK_INSERT_INSTRUCTIONS.md`** - This instruction file

## Step-by-Step Process

### Step 1: Create Students in Bulk

**Endpoint:** `POST /api/academic/bulk-students`

**Headers:**

```
Content-Type: application/json
Authorization: Bearer <your-auth-token>
```

**Payload:** Use the contents of `bulk_grade1_students_payload.json`

**cURL Example:**

```bash
curl -X POST http://localhost:3000/api/academic/bulk-students \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d @bulk_grade1_students_payload.json
```

### Step 2: Create Parents and Link to Students

**Endpoint:** `POST /api/auth/bulk-create-parents`

**Headers:**

```
Content-Type: application/json
Authorization: Bearer <your-auth-token>
```

**Payload:** Use the contents of `bulk_grade1_parents_payload.json`

**cURL Example:**

```bash
curl -X POST http://localhost:3000/api/auth/bulk-create-parents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d @bulk_grade1_parents_payload.json
```

## Data Summary

### Students

- **Total Students:** 20
- **Class Division ID:** `f98eeccd-d3ff-49b9-9d0d-c433ccf3f567` (Grade 1, Division A)
- **Admission Numbers:** 1-20
- **Roll Numbers:** 1, 3-21 (as provided in your data)
- **Admission Date:** Set to 2024-01-01 (you can modify this as needed)

### Parents

- **Total Parents:** 20 (all fathers)
- **All marked as primary guardians**
- **Access level:** Full access for all parents
- **Relationship:** All set to "father"

## Important Notes

1. **Prerequisites:**
   - Ensure the class division with ID `f98eeccd-d3ff-49b9-9d0d-c433ccf3f567` exists
   - Make sure you have admin or principal authentication token
   - The academic year should be set up properly

2. **Order of Operations:**
   - **MUST create students first** before creating parents
   - Parents are linked to students using admission numbers
   - If student creation fails, fix the issue before proceeding to parents

3. **Data Validation:**
   - All phone numbers are validated for Indian mobile format
   - Dates are in ISO format (YYYY-MM-DD)
   - Gender values are "Male" or "Female"
   - Admission numbers must be unique

4. **Error Handling:**
   - If any student already exists (duplicate admission number), the entire batch will fail
   - If any parent already exists (duplicate phone number), that parent will be skipped
   - Check response messages for detailed error information

## Customization Options

### Modify Admission Date

If you want to change the admission date from 2024-01-01, edit the `admission_date` field in `bulk_grade1_students_payload.json`.

### Add Email Addresses

If you have parent email addresses, replace `null` values with email strings in `bulk_grade1_parents_payload.json`.

### Add Address Information

The current payload doesn't include addresses. If needed, you can add an `address` field to each student object.

## Expected Response

### Successful Student Creation

```json
{
  "status": "success",
  "message": "Successfully created 20 students",
  "data": {
    "created_count": 20,
    "students": [...],
    "academic_records": [...],
    "summary": {
      "admission_numbers": ["1", "2", "3", ...],
      "class_divisions": ["f98eeccd-d3ff-49b9-9d0d-c433ccf3f567"]
    }
  }
}
```

### Successful Parent Creation

```json
{
  "status": "success",
  "message": "Successfully created 20 parents with student linkages",
  "data": {
    "created_count": 20,
    "parents": [...],
    "student_linkages": [...]
  }
}
```

## Troubleshooting

### Common Issues

1. **Authentication Error (401):** Ensure your auth token is valid and has admin/principal permissions
2. **Class Division Not Found (404):** Verify the class division ID exists in your database
3. **Duplicate Admission Number (400):** Check if any students already exist with these admission numbers
4. **Invalid Phone Number (400):** Ensure all phone numbers are valid Indian mobile numbers

### Verification Queries

After insertion, you can verify the data using these endpoints:

- `GET /api/academic/class-divisions/f98eeccd-d3ff-49b9-9d0d-c433ccf3f567/students`
- `GET /api/academic/students?class_division_id=f98eeccd-d3ff-49b9-9d0d-c433ccf3f567`

## Support

If you encounter any issues during the bulk insert process, check the server logs for detailed error messages and ensure all prerequisites are met.
