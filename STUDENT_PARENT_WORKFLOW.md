# Student & Parent Creation Workflow

## Overview

This guide explains the correct order for creating students and parents in the School App system.

## 📋 **Required Order**

### 1. Create Students First

Students must be created before parents because:

- Parent creation validates that students exist in the database
- Parent-student mappings require valid student IDs
- Admission numbers are used to link parents to students

### 2. Create Parents Second

Parents are created after students and linked using admission numbers.

## 🎯 **Step-by-Step Workflow**

### **Step 1: Create Students**

#### 1.1 Create Academic Year (if not exists)

```bash
curl -X POST /api/academic/years \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "year_name": "2024-2025",
    "start_date": "2024-06-01",
    "end_date": "2025-03-31",
    "is_active": true
  }'
```

#### 1.2 Create Class Level (if not exists)

```bash
curl -X POST /api/academic/class-levels \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Grade 1",
    "sequence_number": 1
  }'
```

#### 1.3 Create Class Division

```bash
curl -X POST /api/academic/class-divisions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "academic_year_id": "YOUR_ACADEMIC_YEAR_ID",
    "class_level_id": "YOUR_CLASS_LEVEL_ID",
    "division": "A",
    "teacher_id": "YOUR_TEACHER_ID"
  }'
```

#### 1.4 Create Students

```bash
curl -X POST /api/students \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "admission_number": "ADM2024001",
    "full_name": "Alice Smith",
    "date_of_birth": "2018-05-15",
    "admission_date": "2024-06-01",
    "class_division_id": "YOUR_CLASS_DIVISION_ID",
    "roll_number": "01"
  }'
```

**Repeat for multiple students:**

```bash
curl -X POST /api/students \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "admission_number": "ADM2024002",
    "full_name": "Bob Smith",
    "date_of_birth": "2017-08-20",
    "admission_date": "2024-06-01",
    "class_division_id": "YOUR_CLASS_DIVISION_ID",
    "roll_number": "02"
  }'
```

### **Step 2: Create Parents**

#### 2.1 Create Parent Record

```bash
curl -X POST /api/auth/create-parent \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
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
  }'
```

#### 2.2 Parent Self-Registration

The parent can now register using their phone number:

```bash
curl -X POST /api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "1234567890",
    "password": "MyPassword123",
    "role": "parent"
  }'
```

## 🔍 **Verification Steps**

### **Check Students Created**

```bash
curl -X GET "/api/students?page=1&limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### **Check Parents Created**

```bash
curl -X GET "/api/parent-student/parents?page=1&limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### **Check Parent-Student Mappings**

```bash
curl -X GET "/api/parent-student/link" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## ⚠️ **Common Issues & Solutions**

### **Issue 1: "Students not found" Error**

**Cause:** Trying to create parent before students exist
**Solution:** Create students first, then create parent

### **Issue 2: "Student name does not match" Error**

**Cause:** Student name in parent creation doesn't match student record
**Solution:** Use exact student name from database

### **Issue 3: "Primary guardian conflict" Error**

**Cause:** Multiple students with same parent as primary guardian
**Solution:** Only one student per parent can be primary guardian

### **Issue 4: "Failed to fetch parents" Error**

**Cause:** Database connection or query issue
**Solution:** Check database connection and table structure

## 📊 **Database Schema Requirements**

### **Required Tables:**

1. `academic_years` - Academic year management
2. `class_levels` - Grade levels (Grade 1, Grade 2, etc.)
3. `class_divisions` - Class divisions (A, B, C, etc.)
4. `students_master` - Student records
5. `student_academic_records` - Student class assignments
6. `users` - User accounts (including parents)
7. `parent_student_mappings` - Parent-student relationships

### **Required Columns:**

- `users.is_registered` - Tracks parent registration status
- `parent_student_mappings.is_primary_guardian` - Primary guardian flag
- `students_master.admission_number` - Unique student identifier

## 🚀 **Quick Setup Script**

Here's a complete setup script for testing:

```bash
#!/bin/bash

# 1. Create Academic Year
ACADEMIC_YEAR_ID=$(curl -X POST /api/academic/years \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "year_name": "2024-2025",
    "start_date": "2024-06-01",
    "end_date": "2025-03-31",
    "is_active": true
  }' | jq -r '.data.academic_year.id')

echo "Created Academic Year: $ACADEMIC_YEAR_ID"

# 2. Create Class Level
CLASS_LEVEL_ID=$(curl -X POST /api/academic/class-levels \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Grade 1",
    "sequence_number": 1
  }' | jq -r '.data.class_level.id')

echo "Created Class Level: $CLASS_LEVEL_ID"

# 3. Create Class Division
CLASS_DIVISION_ID=$(curl -X POST /api/academic/class-divisions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d "{
    \"academic_year_id\": \"$ACADEMIC_YEAR_ID\",
    \"class_level_id\": \"$CLASS_LEVEL_ID\",
    \"division\": \"A\"
  }" | jq -r '.data.class_division.id')

echo "Created Class Division: $CLASS_DIVISION_ID"

# 4. Create Students
curl -X POST /api/students \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d "{
    \"admission_number\": \"ADM2024001\",
    \"full_name\": \"Alice Smith\",
    \"date_of_birth\": \"2018-05-15\",
    \"admission_date\": \"2024-06-01\",
    \"class_division_id\": \"$CLASS_DIVISION_ID\",
    \"roll_number\": \"01\"
  }"

curl -X POST /api/students \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d "{
    \"admission_number\": \"ADM2024002\",
    \"full_name\": \"Bob Smith\",
    \"date_of_birth\": \"2017-08-20\",
    \"admission_date\": \"2024-06-01\",
    \"class_division_id\": \"$CLASS_DIVISION_ID\",
    \"roll_number\": \"02\"
  }"

echo "Created students"

# 5. Create Parent
curl -X POST /api/auth/create-parent \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
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
  }'

echo "Created parent record"

echo "Setup complete! Parent can now register with phone number: 1234567890"
```

## 📝 **Summary**

**Correct Order:**

1. ✅ Create Academic Year
2. ✅ Create Class Level
3. ✅ Create Class Division
4. ✅ Create Students (with admission numbers)
5. ✅ Create Parent Record (using admission numbers)
6. ✅ Parent Self-Registration

**Key Points:**

- Students must exist before parents
- Use exact admission numbers for linking
- Only one primary guardian per student
- Parent registration is a two-step process

This workflow ensures data integrity and proper parent-student relationships!
