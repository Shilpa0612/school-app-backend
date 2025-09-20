# Grade 8 - Link Children to Existing Parents

These Grade 8 children need to be linked to parents that already exist from previous grades.

## Parents to Link (5 cases)

### 1. Ajinath Gopinath Sule (8180885248)

- **Already exists from**: Grade 5
- **New child**: Aditya Ajinath Sule (admission #180)

**Steps:**

1. Find parent_id: `GET /api/parents?phone_number=8180885248`
2. Find student_id: `GET /api/academic/students?admission_number=180`
3. Link: `POST /api/academic/link-students`

```json
{
  "parent_id": "REPLACE_WITH_ACTUAL_PARENT_ID",
  "students": [
    {
      "student_id": "REPLACE_WITH_ACTUAL_STUDENT_ID",
      "relationship": "father",
      "is_primary_guardian": true,
      "access_level": "full"
    }
  ]
}
```

### 2. Bhagwan Prakash Pawar (9673808384)

- **Already exists from**: Grade 6
- **New child**: Akshara Bhagwan Pawar (admission #182)

**Steps:**

1. Find parent_id: `GET /api/parents?phone_number=9673808384`
2. Find student_id: `GET /api/academic/students?admission_number=182`
3. Link: `POST /api/academic/link-students`

```json
{
  "parent_id": "REPLACE_WITH_ACTUAL_PARENT_ID",
  "students": [
    {
      "student_id": "REPLACE_WITH_ACTUAL_STUDENT_ID",
      "relationship": "father",
      "is_primary_guardian": true,
      "access_level": "full"
    }
  ]
}
```

### 3. Baliram More (9823741777)

- **Already exists from**: Grade 4
- **New child**: Darshana Baliram More (admission #189)

**Steps:**

1. Find parent_id: `GET /api/parents?phone_number=9823741777`
2. Find student_id: `GET /api/academic/students?admission_number=189`
3. Link: `POST /api/academic/link-students`

```json
{
  "parent_id": "REPLACE_WITH_ACTUAL_PARENT_ID",
  "students": [
    {
      "student_id": "REPLACE_WITH_ACTUAL_STUDENT_ID",
      "relationship": "father",
      "is_primary_guardian": true,
      "access_level": "full"
    }
  ]
}
```

### 4. Mahesh Dawkhar (9511716111)

- **Already exists from**: Grade 4 (as "Mahesh Machindra Dawkhar")
- **New child**: Riddhi Mahesh Dawkhar (admission #196)

**Steps:**

1. Find parent_id: `GET /api/parents?phone_number=9511716111`
2. Find student_id: `GET /api/academic/students?admission_number=196`
3. Link: `POST /api/academic/link-students`

```json
{
  "parent_id": "REPLACE_WITH_ACTUAL_PARENT_ID",
  "students": [
    {
      "student_id": "REPLACE_WITH_ACTUAL_STUDENT_ID",
      "relationship": "father",
      "is_primary_guardian": true,
      "access_level": "full"
    }
  ]
}
```

### 5. Sunil Borde (8007407337)

- **Already exists from**: Grade 4 (as "Sunil Ashok Borde")
- **New child**: Samyak Sunil Borde (admission #199)

**Steps:**

1. Find parent_id: `GET /api/parents?phone_number=8007407337`
2. Find student_id: `GET /api/academic/students?admission_number=199`
3. Link: `POST /api/academic/link-students`

```json
{
  "parent_id": "REPLACE_WITH_ACTUAL_PARENT_ID",
  "students": [
    {
      "student_id": "REPLACE_WITH_ACTUAL_STUDENT_ID",
      "relationship": "father",
      "is_primary_guardian": true,
      "access_level": "full"
    }
  ]
}
```

### 6. Sunil Laxman Thote (7057131027)

- **Already exists from**: Grade 6
- **New child**: Sanjana Sunil Thote (admission #200)

**Steps:**

1. Find parent_id: `GET /api/parents?phone_number=7057131027`
2. Find student_id: `GET /api/academic/students?admission_number=200`
3. Link: `POST /api/academic/link-students`

### 7. Gajanan Kautikarao Sahane (9158190100)

- **Already exists from**: Grade 1 (as "Raghunath kautikrao Sahane")
- **New child**: Sarthak Gajanan Sahane (admission #201)

**Steps:**

1. Find parent_id: `GET /api/parents?phone_number=9158190100`
2. Find student_id: `GET /api/academic/students?admission_number=201`
3. Link: `POST /api/academic/link-students`

## Grade 8 Complete Process

### Step 1: Create New Parents Only

```bash
POST /api/auth/bulk-create-parents
# Use: bulk_grade8_new_parents_only_payload.json
```

### Step 2: Link 7 Children to Existing Parents

Follow the linking instructions above for each of the 7 cases.

## Summary

- **New parents to create**: 21
- **Children to link to existing parents**: 7
- **Total Grade 8 students**: 30 (all will have proper parent relationships)

This approach ensures no duplicate parent creation errors while maintaining proper relationships.
