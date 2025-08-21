# Separate Parent and Student Management System

## Overview

The school app now supports **separate creation and management** of parents and students, making the system more flexible and easier to manage. This replaces the previous complex combined approach where students were created first, then parents with student data embedded.

## Key Benefits

1. **Flexibility**: Create parents and students independently
2. **Multiple Relationships**: Link multiple parents to multiple students
3. **Easier Management**: Update parent or student information separately
4. **Better Workflow**: More intuitive for administrative staff
5. **Scalability**: Easier to handle complex family structures

## New API Endpoints

### Parent Management (`/api/parents`)

#### Create Parent

```http
POST /api/parents
```

- Creates a parent record without linking to students
- Parent can register later using their phone number
- Optional initial password for onboarding

#### Get All Parents

```http
GET /api/parents?page=1&limit=20&search=parent
```

- Paginated list with search functionality
- Shows linked students for each parent

#### Get Specific Parent

```http
GET /api/parents/:parent_id
```

- Detailed parent information
- List of all linked students

#### Update Parent

```http
PUT /api/parents/:parent_id
```

- Update parent details
- Change initial password if needed

#### Delete Parent

```http
DELETE /api/parents/:parent_id
```

- Cannot delete if linked to students
- Must unlink all students first

#### Link Students to Parent

```http
POST /api/parents/:parent_id/link-students
```

- Link multiple students to one parent
- Define relationship and access levels
- Handle primary guardian conflicts

#### Unlink Student from Parent

```http
DELETE /api/parents/:parent_id/unlink-student/:student_id
```

- Remove specific student-parent relationship

### Student Management (`/api/students-management`)

#### Create Student

```http
POST /api/students-management
```

- Creates student with academic record
- Validates admission number uniqueness
- Checks roll number availability in class

#### Get All Students

```http
GET /api/students-management?page=1&limit=20&search=student&class_division_id=uuid&status=active
```

- Paginated list with filters
- Shows linked parents for each student

#### Get Specific Student

```http
GET /api/students-management/:student_id
```

- Detailed student information
- Academic records and linked parents

#### Update Student

```http
PUT /api/students-management/:student_id
```

- Update student details
- Change status if needed

#### Delete Student

```http
DELETE /api/students-management/:student_id
```

- Cannot delete if linked to parents
- Must unlink all parents first

#### Link Parents to Student

```http
POST /api/students-management/:student_id/link-parents
```

- Link multiple parents to one student
- Define relationships and access levels
- Handle primary guardian conflicts

#### Unlink Parent from Student

```http
DELETE /api/students-management/:student_id/unlink-parent/:parent_id
```

- Remove specific parent-student relationship

## Workflow Examples

### Scenario 1: New Family Registration

1. **Create Parent**

   ```bash
   POST /api/parents
   {
     "full_name": "John Smith",
     "phone_number": "1234567890",
     "email": "john@example.com",
     "initial_password": "Temp@1234"
   }
   ```

2. **Create Student**

   ```bash
   POST /api/students-management
   {
     "admission_number": "2024001",
     "full_name": "Alice Smith",
     "date_of_birth": "2018-01-01",
     "admission_date": "2024-01-01",
     "class_division_id": "uuid",
     "roll_number": "01"
   }
   ```

3. **Link Parent to Student**
   ```bash
   POST /api/parents/{parent_id}/link-students
   {
     "students": [
       {
         "student_id": "{student_id}",
         "relationship": "father",
         "is_primary_guardian": true,
         "access_level": "full"
       }
     ]
   }
   ```

### Scenario 2: Multiple Children Family

1. **Create Parent** (same as above)

2. **Create Multiple Students**

   ```bash
   POST /api/students-management
   # Create first child

   POST /api/students-management
   # Create second child
   ```

3. **Link Parent to All Children**
   ```bash
   POST /api/parents/{parent_id}/link-students
   {
     "students": [
       {
         "student_id": "{child1_id}",
         "relationship": "father",
         "is_primary_guardian": true,
         "access_level": "full"
       },
       {
         "student_id": "{child2_id}",
         "relationship": "father",
         "is_primary_guardian": true,
         "access_level": "full"
       }
     ]
   }
   ```

### Scenario 3: Multiple Parents for One Student

1. **Create Multiple Parents**

   ```bash
   POST /api/parents
   # Create father

   POST /api/parents
   # Create mother
   ```

2. **Create Student** (same as above)

3. **Link Both Parents to Student**
   ```bash
   POST /api/students-management/{student_id}/link-parents
   {
     "parents": [
       {
         "parent_id": "{father_id}",
         "relationship": "father",
         "is_primary_guardian": true,
         "access_level": "full"
       },
       {
         "parent_id": "{mother_id}",
         "relationship": "mother",
         "is_primary_guardian": false,
         "access_level": "full"
       }
     ]
   }
   ```

## Data Validation Rules

### Parent Creation

- Phone number must be unique
- Phone number format: 10 digits
- Email format validation
- Initial password minimum 6 characters

### Student Creation

- Admission number must be unique
- Roll number must be unique within class
- Valid class division must exist
- Date formats validation

### Linking Rules

- Only one primary guardian per student
- No duplicate parent-student mappings
- Valid relationship types: father, mother, guardian
- Valid access levels: full, restricted, readonly

## Error Handling

### Common Error Scenarios

1. **Duplicate Phone Number**

   ```json
   {
     "status": "error",
     "message": "Parent with this phone number already exists",
     "data": {
       "parent_id": "existing_id",
       "is_registered": true
     }
   }
   ```

2. **Duplicate Admission Number**

   ```json
   {
     "status": "error",
     "message": "Student with this admission number already exists",
     "data": {
       "student_id": "existing_id",
       "admission_number": "2024001"
     }
   }
   ```

3. **Primary Guardian Conflict**

   ```json
   {
     "status": "error",
     "message": "Student already has a primary guardian"
   }
   ```

4. **Cannot Delete with Links**
   ```json
   {
     "status": "error",
     "message": "Cannot delete parent with linked students. Please unlink all students first.",
     "data": {
       "linked_students_count": 2
     }
   }
   ```

## Migration from Legacy System

The legacy combined system (`/api/auth/create-parent` and `/api/students`) is still available for backward compatibility. However, it's recommended to use the new separate system for:

- New implementations
- Better data management
- More flexible workflows
- Easier maintenance

## Security Considerations

1. **Authorization**: All endpoints require admin/principal role
2. **Data Validation**: Comprehensive input validation
3. **Relationship Integrity**: Prevents orphaned records
4. **Audit Trail**: All operations are logged
5. **Access Control**: Role-based permissions enforced

## Performance Optimizations

1. **Pagination**: All list endpoints support pagination
2. **Search**: Efficient search across multiple fields
3. **Indexing**: Database indexes on frequently queried fields
4. **Caching**: Response caching for frequently accessed data
5. **Batch Operations**: Support for linking multiple records at once
