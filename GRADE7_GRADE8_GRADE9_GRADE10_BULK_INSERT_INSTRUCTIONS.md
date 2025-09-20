# Grade 7, 8, 9 & 10 Bulk Insert Instructions

This guide provides step-by-step instructions to bulk insert Grade 7, 8, 9, and 10 students and their parents into the school management system.

## Files Created

### Grade 7 Files

1. **`bulk_grade7_students_payload.json`** - Contains 24 Grade 7 students for bulk insertion
2. **`bulk_grade7_parents_payload.json`** - Contains 24 Grade 7 parents for bulk insertion

### Grade 8 Files

3. **`bulk_grade8_students_payload.json`** - Contains 30 Grade 8 students for bulk insertion
4. **`bulk_grade8_parents_payload.json`** - Contains 28 Grade 8 parents for bulk insertion

### Grade 9 Files

5. **`bulk_grade9_students_payload.json`** - Contains 24 Grade 9 students for bulk insertion
6. **`bulk_grade9_parents_payload.json`** - Contains 24 Grade 9 parents for bulk insertion

### Grade 10 Files

7. **`bulk_grade10_students_payload.json`** - Contains 15 Grade 10 students for bulk insertion
8. **`bulk_grade10_parents_payload.json`** - Contains 15 Grade 10 parents for bulk insertion

## Step-by-Step Process

### Step 1: Create Grade 7 Students

**Endpoint:** `POST /api/academic/bulk-students`

**Headers:**

```
Content-Type: application/json
Authorization: Bearer <your-auth-token>
```

**Payload:** Use the contents of `bulk_grade7_students_payload.json`

**cURL Example:**

```bash
curl -X POST http://localhost:3000/api/academic/bulk-students \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d @bulk_grade7_students_payload.json
```

### Step 2: Create Grade 7 Parents

**Endpoint:** `POST /api/auth/bulk-create-parents`

**Payload:** Use the contents of `bulk_grade7_parents_payload.json`

**cURL Example:**

```bash
curl -X POST http://localhost:3000/api/auth/bulk-create-parents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d @bulk_grade7_parents_payload.json
```

### Step 3: Create Grade 8 Students

**Endpoint:** `POST /api/academic/bulk-students`

**Payload:** Use the contents of `bulk_grade8_students_payload.json`

**cURL Example:**

```bash
curl -X POST http://localhost:3000/api/academic/bulk-students \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d @bulk_grade8_students_payload.json
```

### Step 4: Create Grade 8 Parents

**Endpoint:** `POST /api/auth/bulk-create-parents`

**Payload:** Use the contents of `bulk_grade8_parents_payload.json`

**cURL Example:**

```bash
curl -X POST http://localhost:3000/api/auth/bulk-create-parents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d @bulk_grade8_parents_payload.json
```

### Step 5: Create Grade 9 Students

**Endpoint:** `POST /api/academic/bulk-students`

**Payload:** Use the contents of `bulk_grade9_students_payload.json`

**cURL Example:**

```bash
curl -X POST http://localhost:3000/api/academic/bulk-students \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d @bulk_grade9_students_payload.json
```

### Step 6: Create Grade 9 Parents

**Endpoint:** `POST /api/auth/bulk-create-parents`

**Payload:** Use the contents of `bulk_grade9_parents_payload.json`

**cURL Example:**

```bash
curl -X POST http://localhost:3000/api/auth/bulk-create-parents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d @bulk_grade9_parents_payload.json
```

### Step 7: Create Grade 10 Students

**Endpoint:** `POST /api/academic/bulk-students`

**Payload:** Use the contents of `bulk_grade10_students_payload.json`

**cURL Example:**

```bash
curl -X POST http://localhost:3000/api/academic/bulk-students \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d @bulk_grade10_students_payload.json
```

### Step 8: Create Grade 10 Parents

**Endpoint:** `POST /api/auth/bulk-create-parents`

**Payload:** Use the contents of `bulk_grade10_parents_payload.json`

**cURL Example:**

```bash
curl -X POST http://localhost:3000/api/auth/bulk-create-parents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d @bulk_grade10_parents_payload.json
```

## Data Summary

### Grade 7 (Class Level ID: ff8c9da6-d410-496f-b7f1-b938bf7bb7b1)

- **Division ID:** `f3473925-bdb7-4161-970d-5139ab7e0123` (Grade 7, Division A)
- **Total Students:** 24
- **Total Parents:** 24
- **Admission Numbers:** 155-178
- **Roll Numbers:** 1-25 (note: roll 9 missing in data)
- **Admission Date:** 2025-01-01

### Grade 8 (Class Level ID: 5c2031dc-bebc-4a91-9917-9f31a35bce49)

- **Division ID:** `ed672f44-086a-4f60-bf77-c2df1f40487d` (Grade 8, Division A)
- **Total Students:** 30
- **Total Parents:** 28 (Madhav Dhere has twins, Dnyaneshwar More has 2 children)
- **Admission Numbers:** 179-208
- **Roll Numbers:** 1-30
- **Admission Date:** 2025-01-01

### Grade 9 (Class Level ID: d13c38cd-5b64-415d-919e-684178ef7455)

- **Division ID:** `83f007ab-55a4-4c80-9a5d-678bc2c96436` (Grade 9, Division A)
- **Total Students:** 24
- **Total Parents:** 24
- **Admission Numbers:** 209-232
- **Roll Numbers:** 1-24
- **Admission Date:** 2025-01-01

### Grade 10 (Class Level ID: 497dbda0-3ff9-4a53-9b4f-33f70900bafd)

- **Division ID:** `9dee9c80-eedd-4e2c-bbed-9b6c7e9edf33` (Grade 10, Division A)
- **Total Students:** 15
- **Total Parents:** 15
- **Admission Numbers:** 233-247
- **Roll Numbers:** 1-15
- **Admission Date:** 2025-01-01

## Important Notes

### Prerequisites

- Ensure all class divisions exist in your database:
  - Grade 7 Division A: `f3473925-bdb7-4161-970d-5139ab7e0123`
  - Grade 8 Division A: `ed672f44-086a-4f60-bf77-c2df1f40487d`
  - Grade 9 Division A: `83f007ab-55a4-4c80-9a5d-678bc2c96436`
  - Grade 10 Division A: `9dee9c80-eedd-4e2c-bbed-9b6c7e9edf33`
- Have admin or principal authentication token ready
- Academic year should be properly set up

### Order of Operations

1. **MUST create students first** before creating parents
2. Parents are linked to students using admission numbers
3. Complete each grade in sequence (students → parents) before starting the next grade
4. Recommended order: Grade 7 → Grade 8 → Grade 9 → Grade 10

### Data Validation

- All phone numbers validated for Indian mobile format
- Dates in ISO format (YYYY-MM-DD)
- Gender values: "male" or "female" (lowercase)
- Admission numbers must be unique across the entire school

### Special Cases & Data Handling

#### Multiple Children - Same Parent

- **Madhav Dhere (9403035512):** Has twins in Grade 8 - Apurva & Atharva (admission #185, #186)
- **Dnyaneshwar Sukhdev More (9764968833):** Has 2 children in Grade 8 - Amar & Vaishnavi (admission #183, #204)

#### Duplicate Parents Across Grades

Several parents appear in multiple grades. Handle carefully:

- **Vinod Shipahi Giri (7972209988):** Grade 4 & Grade 7
- **Asaram Khandare (9511628552):** Grade 5 & Grade 7
- **Punamsingh Sulane (7020781320):** Grade 5 & Grade 7
- **Shailendra Kshirsagar (9595963444):** Grade 2 & Grade 7
- **Aniruddha Babasaheb Ekhande (9923149457):** Grade 3, Grade 7 & Grade 9
- **Pratap Baburao Pawar (9860227714):** Grade 4 & Grade 7
- **Ajinath Gopinath Sule (8180885248):** Grade 5 & Grade 8
- **Bhagwan Prakash Pawar (9673808384):** Grade 6 & Grade 8
- **Dnyaneshwar Sukhdev More (9764968833):** Grade 4 & Grade 8 (2 children in Grade 8)
- **Baliram More (9823741777):** Grade 4 & Grade 8
- **Sunil Laxman Thote (7057131027):** Grade 6 & Grade 8
- **Gajanan Kautikarao Sahane (9158190100):** Grade 5 & Grade 8
- **Raju Rathod (9422214748):** Grade 4 & Grade 9
- **Satish Ramrao Sonawane (9689614614):** Grade 8 & Grade 9
- **Prakash Subhash Sawant (9423124040):** Grade 6 & Grade 9
- **Santosh Kharat (9561696377):** Grade 7 & Grade 9
- **Sachin Bhimrao Mhaske (9405063567):** Grade 4 & Grade 9
- **Omprakash Devilal Kumawat (8390170470):** Grade 7 & Grade 10
- **Milind Wankhade (9511275562):** Grade 6 & Grade 10
- **Vishwambhar Tirukhe (9730568555):** Grade 9 & Grade 10
- **Machindra Devidas Chavan (9503536663):** Grade 9 & Grade 10
- **Dattu Wagh (9730000026):** Grade 6 & Grade 10
- **Shaji Panicker:** Different phones - Grade 6 (8788613231) & Grade 10 (8605612697)

#### Phone Number Variations

- **Nilesh Kumbhalkar:** Grade 5 (8830078945) vs Grade 10 (8830080910)
- **Krushna Thombre:** Grade 6 (9881583606) vs Grade 10 (8208767176)
- **Dipak Borhade:** Grade 8 (7972000217) vs Grade 10 (7972000217) - Same number

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
# Grade 7 students
GET /api/academic/class-divisions/f3473925-bdb7-4161-970d-5139ab7e0123/students

# Grade 8 students
GET /api/academic/class-divisions/ed672f44-086a-4f60-bf77-c2df1f40487d/students

# Grade 9 students
GET /api/academic/class-divisions/83f007ab-55a4-4c80-9a5d-678bc2c96436/students

# Grade 10 students
GET /api/academic/class-divisions/9dee9c80-eedd-4e2c-bbed-9b6c7e9edf33/students
```

### Parent Login Testing

Test parent login with any created parent:

```bash
POST /api/auth/login
{
  "phone_number": "7972209988",
  "password": "Temp@1234"
}
```

## Summary Statistics

- **Total Students:** 93 (24 Grade 7 + 30 Grade 8 + 24 Grade 9 + 15 Grade 10)
- **Total Parents:** 91 (handling duplicates may reduce this number significantly)
- **Admission Numbers:** 155-247
- **All parents can login immediately with:** Phone + `Temp@1234`

## Age Range Analysis

- **Grade 7:** Born 2009-2014 (ages 11-16)
- **Grade 8:** Born 2010-2013 (ages 12-15)
- **Grade 9:** Born 2011-2012 (ages 13-14)
- **Grade 10:** Born 2008-2011 (ages 14-17)

## Support

If you encounter issues during bulk insertion:

1. Check server logs for detailed error messages
2. Verify all prerequisites are met
3. Handle duplicate parent phone numbers appropriately
4. Ensure proper order of operations (students before parents)
5. Consider creating parents in smaller batches if needed
6. Use the parent linking endpoint for parents with multiple children across grades
