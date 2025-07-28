# School App - Data Formats and Endpoints Documentation

## Data Formats

### Grade/Class Level Format
```sql
-- Recommended format for class_levels table
{
    "name": "Grade 1",        // Format: "Grade N" where N is the grade number
    "sequence_number": 1      // Numeric value for ordering (1, 2, 3, etc.)
}

Example insertions:
INSERT INTO class_levels (name, sequence_number) VALUES
    ('Grade 1', 1),
    ('Grade 2', 2),
    ('Grade 3', 3),
    ('Grade 4', 4),
    ('Grade 5', 5);
```

### Division Format
```sql
-- Format for class divisions
{
    "division": "A",          // Single uppercase letter (A, B, C, etc.)
    "academic_year_id": uuid, // Reference to academic year
    "class_level_id": uuid,  // Reference to class level
    "teacher_id": uuid       // Assigned class teacher
}
```

## API Endpoints with Payloads

### 1. Academic Year Management

#### Create Academic Year
```http
POST /api/academic/years

Request:
{
    "year_name": "2024-2025",
    "start_date": "2024-06-01",
    "end_date": "2025-03-31",
    "is_active": true
}

Response:
{
    "status": "success",
    "data": {
        "id": "uuid",
        "year_name": "2024-2025",
        "start_date": "2024-06-01",
        "end_date": "2025-03-31",
        "is_active": true,
        "created_at": "2024-01-01T00:00:00Z"
    }
}
```

### 2. Class Level Management

#### Create Class Level
```http
POST /api/academic/levels

Request:
{
    "name": "Grade 1",
    "sequence_number": 1
}

Response:
{
    "status": "success",
    "data": {
        "id": "uuid",
        "name": "Grade 1",
        "sequence_number": 1,
        "created_at": "2024-01-01T00:00:00Z"
    }
}
```

#### Get All Class Levels
```http
GET /api/academic/levels

Response:
{
    "status": "success",
    "data": {
        "levels": [
            {
                "id": "uuid",
                "name": "Grade 1",
                "sequence_number": 1
            },
            {
                "id": "uuid",
                "name": "Grade 2",
                "sequence_number": 2
            }
        ]
    }
}
```

### 3. Class Division Management

#### Create Class Division
```http
POST /api/academic/divisions

Request:
{
    "academic_year_id": "uuid",
    "class_level_id": "uuid",
    "division": "A",
    "teacher_id": "uuid"
}

Response:
{
    "status": "success",
    "data": {
        "id": "uuid",
        "academic_year_id": "uuid",
        "class_level_id": "uuid",
        "division": "A",
        "teacher_id": "uuid",
        "created_at": "2024-01-01T00:00:00Z"
    }
}
```

### 4. Student Management

#### Register New Student
```http
POST /api/academic/students

Request:
{
    "admission_number": "2024001",
    "full_name": "John Doe",
    "date_of_birth": "2018-05-15",
    "admission_date": "2024-06-01",
    "class_division_id": "uuid",
    "roll_number": "01"
}

Response:
{
    "status": "success",
    "data": {
        "student": {
            "id": "uuid",
            "admission_number": "2024001",
            "full_name": "John Doe",
            "date_of_birth": "2018-05-15",
            "admission_date": "2024-06-01",
            "status": "active",
            "created_at": "2024-01-01T00:00:00Z"
        },
        "academic_record": {
            "id": "uuid",
            "class_division_id": "uuid",
            "roll_number": "01",
            "status": "ongoing"
        }
    }
}
```

### 5. Parent-Student Relationship

#### Link Parent to Students
```http
POST /api/academic/link-students

Request:
{
    "parent_id": "uuid",
    "students": [
        {
            "student_id": "uuid",
            "relationship": "father",
            "is_primary_guardian": true,
            "access_level": "full"
        },
        {
            "student_id": "uuid",
            "relationship": "father",
            "is_primary_guardian": false,
            "access_level": "full"
        }
    ]
}

Response:
{
    "status": "success",
    "data": {
        "mappings": [
            {
                "id": "uuid",
                "parent_id": "uuid",
                "student_id": "uuid",
                "relationship": "father",
                "is_primary_guardian": true,
                "access_level": "full"
            }
        ]
    }
}
```

### 6. Student Promotion

#### Get Promotion Eligible Students
```http
GET /api/academic/promotion-eligible/:academic_year_id

Response:
{
    "status": "success",
    "data": {
        "eligible_students": [
            {
                "id": "uuid",
                "student": {
                    "id": "uuid",
                    "admission_number": "2024001",
                    "full_name": "John Doe",
                    "status": "active"
                },
                "class": {
                    "id": "uuid",
                    "division": "A",
                    "level": {
                        "name": "Grade 1",
                        "sequence_number": 1
                    }
                },
                "roll_number": "01",
                "status": "ongoing"
            }
        ]
    }
}
```

#### Promote Students
```http
POST /api/academic/promote-selected

Request:
{
    "to_academic_year_id": "uuid",
    "promotions": [
        {
            "student_id": "uuid",
            "new_class_division_id": "uuid",
            "new_roll_number": "01"
        }
    ]
}

Response:
{
    "status": "success",
    "data": {
        "promoted_records": [
            {
                "student_id": "uuid",
                "old_class_id": "uuid",
                "new_class_id": "uuid",
                "status": "ongoing"
            }
        ]
    }
}
```

### 7. Student Academic History

#### Get Student History
```http
GET /api/academic/student-history/:student_id

Response:
{
    "status": "success",
    "data": {
        "academic_history": [
            {
                "academic_year": {
                    "year_name": "2023-2024",
                    "start_date": "2023-06-01",
                    "end_date": "2024-03-31"
                },
                "class": {
                    "division": "A",
                    "level": {
                        "name": "Grade 1",
                        "sequence_number": 1
                    },
                    "teacher": {
                        "full_name": "Teacher Name"
                    }
                },
                "roll_number": "01",
                "status": "promoted"
            }
        ],
        "parents": [
            {
                "relationship": "father",
                "is_primary_guardian": true,
                "access_level": "full",
                "parent": {
                    "full_name": "Parent Name",
                    "phone_number": "1234567890",
                    "email": "parent@example.com"
                }
            }
        ]
    }
}
```

## Data Validation Rules

### 1. Grade/Class Level
- Name format: "Grade N" where N is the grade number
- Sequence number must be unique and sequential
- Cannot delete a class level that has active students

### 2. Division
- Single uppercase letter (A, B, C, etc.)
- Must be unique within a class level and academic year
- Must have an assigned teacher

### 3. Roll Numbers
- Format: Two digits (01, 02, etc.)
- Must be unique within a class division
- Only required for 'ongoing' status

### 4. Academic Year
- Format: "YYYY-YYYY" (e.g., "2024-2025")
- End date must be after start date
- Only one active academic year allowed

### 5. Parent-Student Relationship
- Only one primary guardian per student
- Valid relationships: father, mother, guardian
- Valid access levels: full, restricted, readonly

## Common Response Formats

### Success Response
```json
{
    "status": "success",
    "data": {
        // Response data
    }
}
```

### Error Response
```json
{
    "status": "error",
    "message": "Error description",
    "errors": [
        {
            "field": "field_name",
            "message": "Validation error message"
        }
    ]
}
```

## Status Codes

- 200: Success
- 201: Created
- 400: Bad Request (Validation Error)
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 409: Conflict (e.g., Duplicate Entry)
- 500: Internal Server Error 