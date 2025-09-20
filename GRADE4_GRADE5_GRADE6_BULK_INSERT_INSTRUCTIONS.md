# Grade 4, 5 & 6 Bulk Insert Instructions

This guide provides step-by-step instructions to bulk insert Grade 4, 5, and 6 students and their parents into the school management system.

## Files Created

### Grade 4 Files

1. **`bulk_grade4_students_payload.json`** - Contains 24 Grade 4 students for bulk insertion
2. **`bulk_grade4_parents_payload.json`** - Contains 24 Grade 4 parents for bulk insertion

### Grade 5 Files

3. **`bulk_grade5_students_payload.json`** - Contains 26 Grade 5 students for bulk insertion
4. **`bulk_grade5_parents_payload.json`** - Contains 26 Grade 5 parents for bulk insertion

### Grade 6 Files

5. **`bulk_grade6_students_payload.json`** - Contains 31 Grade 6 students for bulk insertion
6. **`bulk_grade6_parents_payload.json`** - Contains 31 Grade 6 parents for bulk insertion

## Step-by-Step Process

### Step 1: Create Grade 4 Students

**Endpoint:** `POST /api/academic/bulk-students`

**Headers:**

```
Content-Type: application/json
Authorization: Bearer <your-auth-token>
```

**Payload:** Use the contents of `bulk_grade4_students_payload.json`

**cURL Example:**

```bash
curl -X POST http://localhost:3000/api/academic/bulk-students \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d @bulk_grade4_students_payload.json
```

### Step 2: Create Grade 4 Parents

**Endpoint:** `POST /api/auth/bulk-create-parents`

**Payload:** Use the contents of `bulk_grade4_parents_payload.json`

**cURL Example:**

```bash
curl -X POST http://localhost:3000/api/auth/bulk-create-parents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d @bulk_grade4_parents_payload.json
```

### Step 3: Create Grade 5 Students

**Endpoint:** `POST /api/academic/bulk-students`

**Payload:** Use the contents of `bulk_grade5_students_payload.json`

**cURL Example:**

```bash
curl -X POST http://localhost:3000/api/academic/bulk-students \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d @bulk_grade5_students_payload.json
```

### Step 4: Create Grade 5 Parents

**Endpoint:** `POST /api/auth/bulk-create-parents`

**Payload:** Use the contents of `bulk_grade5_parents_payload.json`

**cURL Example:**

```bash
curl -X POST http://localhost:3000/api/auth/bulk-create-parents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d @bulk_grade5_parents_payload.json
```

### Step 5: Create Grade 6 Students

**Endpoint:** `POST /api/academic/bulk-students`

**Payload:** Use the contents of `bulk_grade6_students_payload.json`

**cURL Example:**

```bash
curl -X POST http://localhost:3000/api/academic/bulk-students \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d @bulk_grade6_students_payload.json
```

### Step 6: Create Grade 6 Parents

**Endpoint:** `POST /api/auth/bulk-create-parents`

**Payload:** Use the contents of `bulk_grade6_parents_payload.json`

**cURL Example:**

```bash
curl -X POST http://localhost:3000/api/auth/bulk-create-parents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d @bulk_grade6_parents_payload.json
```

## Data Summary

### Grade 4 (Class Level ID: e340716a-b2e0-47d7-98ec-6a551181bd4b)

- **Division ID:** `be23b2e7-8776-4627-8175-84872f500f22` (Grade 4, Division A)
- **Total Students:** 24
- **Total Parents:** 24
- **Admission Numbers:** 74-97
- **Roll Numbers:** 1-24
- **Admission Date:** 2025-01-01

### Grade 5 (Class Level ID: 8ac99e47-6edf-4591-9534-266b7545af18)

- **Division ID:** `4f1c7d77-b748-4a3f-b86f-9b820829c35a` (Grade 5, Division A)
- **Total Students:** 26
- **Total Parents:** 26
- **Admission Numbers:** 98-123
- **Roll Numbers:** 1-26
- **Admission Date:** 2025-01-01

### Grade 6 (Class Level ID: a5055d6b-57e2-4c88-b5ee-2d753b2eb89e)

- **Division ID:** `cc642758-cc00-4ead-a875-9a514aa499bd` (Grade 6, Division A)
- **Total Students:** 31
- **Total Parents:** 31
- **Admission Numbers:** 124-154
- **Roll Numbers:** 1-31
- **Admission Date:** 2025-01-01

## Important Notes

### Prerequisites

- Ensure all class divisions exist in your database:
  - Grade 4 Division A: `be23b2e7-8776-4627-8175-84872f500f22`
  - Grade 5 Division A: `4f1c7d77-b748-4a3f-b86f-9b820829c35a`
  - Grade 6 Division A: `cc642758-cc00-4ead-a875-9a514aa499bd`
- Have admin or principal authentication token ready
- Academic year should be properly set up

### Order of Operations

1. **MUST create students first** before creating parents
2. Parents are linked to students using admission numbers
3. Complete each grade in sequence (students → parents) before starting the next grade
4. Recommended order: Grade 4 → Grade 5 → Grade 6

### Data Validation

- All phone numbers validated for Indian mobile format
- Dates in ISO format (YYYY-MM-DD)
- Gender values: "male" or "female" (lowercase)
- Admission numbers must be unique across the entire school

### Special Cases & Data Fixes

#### Phone Number Corrections

- **Abdul Nadim Abdul Hakim Dange:** Original phone "80,550,050,559,552" corrected to "8055005055"

#### Duplicate Parent Handling

Several parents appear in multiple grades. Handle carefully:

- **Jalindar Devidas Chavan (9503546663):** Appears in Grade 4 & Grade 6
- **Rohit Sharma/Rohit Santosh Sharma (9673071555):** Appears in Grade 4 & Grade 5
- **Shivhari Shankar Gutte (7822007544):** Appears in Grade 5 (different from previous grades)
- **Sham Sandipan Mogarge (9423337937):** Appears in Grade 3 & Grade 6
- **Sunil Subhash Soni (9922939991):** Appears in Grade 6 (different from previous grades)
- **Manish Singh/Manish Ashok Singh (7058280058):** Appears in Grade 4 & Grade 6
- **Vikas Rampravesh Patel (different phone):** Grade 3 uses 9552164689, Grade 5 uses 8766660778
- **Karan Tambe (7526977034):** Appears in Grade 3 & Grade 6

#### Shared Phone Numbers in Grade 4

- **Phone 9209162741:** Shared by Ganesh Haribhau Ahinde & Babasaheb Rambhau Ahinde (both fathers of different students)

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
4. **Duplicate Phone Number (400):** Handle parents who appear in multiple grades
5. **Invalid Phone Number (400):** Validate all phone numbers
6. **Gender Constraint Violation (23514):** Ensure gender values are lowercase

### Handling Duplicate Parents

When you encounter duplicate parent phone numbers:

1. **Option 1:** Skip creating the duplicate parent (they're already linked to their first child)
2. **Option 2:** Use the parent linking endpoint to add additional children to existing parents
3. **Option 3:** Create parents with slightly different phone numbers (add suffix)

### Verification Queries

After insertion, verify data using:

```bash
# Grade 4 students
GET /api/academic/class-divisions/be23b2e7-8776-4627-8175-84872f500f22/students

# Grade 5 students
GET /api/academic/class-divisions/4f1c7d77-b748-4a3f-b86f-9b820829c35a/students

# Grade 6 students
GET /api/academic/class-divisions/cc642758-cc00-4ead-a875-9a514aa499bd/students
```

### Parent Login Testing

Test parent login with any created parent:

```bash
POST /api/auth/login
{
  "phone_number": "9422214748",
  "password": "Temp@1234"
}
```

## Summary Statistics

- **Total Students:** 81 (24 Grade 4 + 26 Grade 5 + 31 Grade 6)
- **Total Parents:** 81 (handling duplicates may reduce this number)
- **Admission Numbers:** 74-154
- **All parents can login immediately with:** Phone + `Temp@1234`

## Remaining Class IDs (Not Included in This Batch)

For future reference, these class division IDs were provided but no data was included:

- **Grade 7:** ff8c9da6-d410-496f-b7f1-b938bf7bb7b1 → f3473925-bdb7-4161-970d-5139ab7e0123
- **Grade 8:** 5c2031dc-bebc-4a91-9917-9f31a35bce49 → ed672f44-086a-4f60-bf77-c2df1f40487d
- **Grade 9:** d13c38cd-5b64-415d-919e-684178ef7455 → 83f007ab-55a4-4c80-9a5d-678bc2c96436
- **Grade 10:** 497dbda0-3ff9-4a53-9b4f-33f70900bafd → 9dee9c80-eedd-4e2c-bbed-9b6c7e9edf33
- **LKG:** 5cd7494c-4389-4236-b8a5-8199eca198b9 → b7a57b39-aaeb-40b2-b279-3edcdb75de40
- **NUR:** 3cdc6292-545c-4008-b8c2-b53c89865ec4 → 1bc6b23f-2c35-400a-825f-a5b90fa2f2f5
- **UKG:** 3af42f4c-6862-403e-8e7c-7121896f079b → 8425282b-5dd9-45d9-b582-86b876c3abaf

## Support

If you encounter issues during bulk insertion:

1. Check server logs for detailed error messages
2. Verify all prerequisites are met
3. Handle duplicate parent phone numbers appropriately
4. Ensure proper order of operations (students before parents)
5. Consider creating parents in smaller batches if needed
