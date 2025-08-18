# Teacher-Class Many-to-Many Assignment System

## Overview

This system enables multiple teachers to be assigned to a single class and allows one teacher to be assigned to multiple classes. Each assignment can have different types and roles.

## Database Schema

### New Junction Table: `class_teacher_assignments`

```sql
CREATE TABLE public.class_teacher_assignments (
    id uuid primary key default uuid_generate_v4(),
    class_division_id uuid references public.class_divisions(id) on delete cascade not null,
    teacher_id uuid references public.users(id) on delete restrict not null,
    assignment_type text default 'class_teacher' check (assignment_type in ('class_teacher', 'subject_teacher', 'assistant_teacher', 'substitute_teacher')),
    is_primary boolean default false,
    assigned_date timestamp with time zone default timezone('utc'::text, now()) not null,
    assigned_by uuid references public.users(id) on delete restrict,
    is_active boolean default true,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
```

### Assignment Types

1. **class_teacher**: Main/homeroom teacher responsible for the class
2. **subject_teacher**: Teacher for specific subjects (Math, Science, etc.)
3. **assistant_teacher**: Supporting teacher who helps the primary teacher
4. **substitute_teacher**: Temporary replacement teacher

### Primary Teacher Concept

- Each class can have only ONE primary teacher (`is_primary = true`)
- Primary teacher is typically the homeroom/class teacher
- Other teachers can be assigned as subject or assistant teachers

## API Endpoints

### 1. Get Teachers for a Class (Multiple Teachers Support)

```http
GET /api/academic/class-divisions/:id/teachers
```

**Response:**

```json
{
  "status": "success",
  "data": {
    "class_division": {
      "id": "class-uuid",
      "division": "A",
      "class_name": "Grade 5 A",
      "academic_year": "2024-2025"
    },
    "teachers": [
      {
        "assignment_id": "assignment-uuid",
        "teacher_id": "teacher-uuid",
        "assignment_type": "class_teacher",
        "is_primary": true,
        "assigned_date": "2024-01-15T00:00:00Z",
        "teacher_info": {
          "full_name": "John Doe",
          "phone_number": "+1234567890",
          "email": "john@school.com",
          "department": "Primary"
        }
      },
      {
        "assignment_id": "assignment-uuid-2",
        "teacher_id": "teacher-uuid-2",
        "assignment_type": "subject_teacher",
        "is_primary": false,
        "assigned_date": "2024-01-20T00:00:00Z",
        "teacher_info": {
          "full_name": "Jane Smith",
          "phone_number": "+1234567891",
          "email": "jane@school.com",
          "department": "Mathematics"
        }
      }
    ],
    "primary_teacher": {
      /* primary teacher object */
    },
    "total_teachers": 2,
    "has_teachers": true
  }
}
```

### 2. Assign Teacher to Class

```http
POST /api/academic/class-divisions/:id/assign-teacher
```

**Request Body:**

```json
{
  "teacher_id": "teacher-uuid",
  "assignment_type": "subject_teacher",
  "is_primary": false
}
```

**Response:**

```json
{
  "status": "success",
  "data": {
    "assignment": {
      "id": "assignment-uuid",
      "class_division_id": "class-uuid",
      "teacher_id": "teacher-uuid",
      "assignment_type": "subject_teacher",
      "is_primary": false,
      "assigned_date": "2024-01-20T00:00:00Z"
    },
    "message": "Teacher Jane Smith successfully assigned to class as subject_teacher"
  }
}
```

### 3. Remove Teacher from Class

```http
DELETE /api/academic/class-divisions/:id/remove-teacher/:teacher_id?assignment_type=subject_teacher
```

**Response:**

```json
{
  "status": "success",
  "data": {
    "removed_assignments": 1,
    "assignment_ids": ["assignment-uuid"]
  },
  "message": "Teacher successfully removed from class"
}
```

### 4. Get All Classes for a Teacher

```http
GET /api/academic/teachers/:teacher_id/classes
```

**Response:**

```json
{
  "status": "success",
  "data": {
    "teacher": {
      "id": "teacher-uuid",
      "full_name": "John Doe"
    },
    "assignments": [
      {
        "assignment_id": "assignment-uuid",
        "assignment_type": "class_teacher",
        "is_primary": true,
        "assigned_date": "2024-01-15T00:00:00Z",
        "class_info": {
          "class_division_id": "class-uuid",
          "division": "A",
          "class_name": "Grade 5 A",
          "class_level": "Grade 5",
          "academic_year": "2024-2025"
        }
      }
    ],
    "primary_classes": [
      /* classes where teacher is primary */
    ],
    "total_assignments": 3,
    "has_assignments": true
  }
}
```

### 5. Update Teacher Assignment

```http
PUT /api/academic/class-divisions/:id/teacher-assignment/:assignment_id
```

**Request Body:**

```json
{
  "assignment_type": "assistant_teacher",
  "is_primary": false
}
```

### 6. Bulk Assign Teachers

```http
POST /api/academic/bulk-assign-teachers
```

**Request Body:**

```json
{
  "assignments": [
    {
      "class_division_id": "class-uuid-1",
      "teacher_id": "teacher-uuid-1",
      "assignment_type": "class_teacher",
      "is_primary": true
    },
    {
      "class_division_id": "class-uuid-1",
      "teacher_id": "teacher-uuid-2",
      "assignment_type": "subject_teacher",
      "is_primary": false
    }
  ]
}
```

## Migration from Legacy System

### Automatic Migration

The system includes automatic migration that:

1. Creates the new junction table
2. Migrates existing teacher assignments from `class_divisions.teacher_id`
3. Sets all existing teachers as primary teachers
4. Maintains backward compatibility

### Manual Migration Steps

1. **Run the migration SQL**: Execute `scripts/manual_migration_steps.sql`
2. **Verify migration**: Check that records were moved correctly
3. **Test new endpoints**: Ensure all API endpoints work correctly
4. **Update frontend**: Modify UI to use new multiple teachers endpoints

### Backward Compatibility

- Legacy endpoint `/class-divisions/:id/teacher` still works
- Falls back to old method if junction table doesn't exist
- Returns primary teacher information for compatibility

## Usage Examples

### Scenario 1: Primary + Subject Teachers

```javascript
// Assign primary teacher (homeroom)
await fetch("/api/academic/class-divisions/class-123/assign-teacher", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    teacher_id: "teacher-primary",
    assignment_type: "class_teacher",
    is_primary: true,
  }),
});

// Assign math teacher
await fetch("/api/academic/class-divisions/class-123/assign-teacher", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    teacher_id: "teacher-math",
    assignment_type: "subject_teacher",
    is_primary: false,
  }),
});

// Assign science teacher
await fetch("/api/academic/class-divisions/class-123/assign-teacher", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    teacher_id: "teacher-science",
    assignment_type: "subject_teacher",
    is_primary: false,
  }),
});
```

### Scenario 2: Teacher Teaching Multiple Classes

```javascript
// Get all classes for a teacher
const response = await fetch("/api/academic/teachers/teacher-123/classes");
const data = await response.json();

console.log(`Teacher teaches ${data.data.total_assignments} classes:`);
data.data.assignments.forEach((assignment) => {
  console.log(
    `- ${assignment.class_info.class_name} (${assignment.assignment_type})`
  );
});
```

### Scenario 3: View All Teachers for a Class

```javascript
// Get all teachers for a class
const response = await fetch(
  "/api/academic/class-divisions/class-123/teachers"
);
const data = await response.json();

console.log(`Class has ${data.data.total_teachers} teachers:`);
console.log(
  `Primary teacher: ${data.data.primary_teacher?.teacher_info.full_name}`
);

data.data.teachers.forEach((teacher) => {
  if (!teacher.is_primary) {
    console.log(
      `- ${teacher.teacher_info.full_name} (${teacher.assignment_type})`
    );
  }
});
```

## Error Handling

### Common Errors

1. **Duplicate Primary Teacher**

   ```json
   {
     "status": "error",
     "message": "Class already has a primary teacher",
     "existing_primary_teacher_id": "teacher-uuid"
   }
   ```

2. **Duplicate Assignment**

   ```json
   {
     "status": "error",
     "message": "Teacher is already assigned to this class with the same assignment type"
   }
   ```

3. **Teacher Not Found**
   ```json
   {
     "status": "error",
     "message": "Teacher not found or invalid role"
   }
   ```

## Best Practices

1. **Always assign a primary teacher** before adding subject teachers
2. **Use specific assignment types** for clarity
3. **Remove assignments** instead of deleting records (soft delete with `is_active = false`)
4. **Check for existing assignments** before creating new ones
5. **Use bulk operations** for efficiency when assigning multiple teachers

## Database Functions

The system includes helper functions:

- `get_class_teachers(class_division_id)`: Get all teachers for a class
- `get_teacher_classes(teacher_id)`: Get all classes for a teacher
- `assign_teacher_to_class()`: Safely assign with validation

## Security

- RLS policies ensure proper access control
- Teachers can only see their own assignments
- Parents can see teachers for their children's classes
- Admin/Principal can manage all assignments
