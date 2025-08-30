# New Simplified Timetable System API Documentation

## Overview

The new timetable system provides a simple, period-based approach to managing class schedules. Instead of complex timing calculations, it focuses on direct subject assignments per period and day.

**Key Features:**

- ✅ **Simple Configuration**: Define total periods and days per week
- ✅ **Direct Assignments**: Period 1 = English, Period 2 = Kannada
- ✅ **No Complex Timing**: Simple period numbers (1, 2, 3, etc.)
- ✅ **Class-Specific**: Each class can have different subject assignments
- ✅ **Bulk Operations**: Create multiple entries at once
- ✅ **Role-Based Access**: Different permissions for different user types

## Base URL

```
http://localhost:3000/api/timetable
```

## Access Control

### **Admin & Principal**

- ✅ **Full Access**: Create, read, update, delete all timetable configurations and entries
- ✅ **All Classes**: Can manage timetables for any class division
- ✅ **Bulk Operations**: Can perform bulk timetable operations

### **Teachers**

- ✅ **View Access**: Can view all timetable configurations
- ✅ **Create/Edit**: Can create and edit timetables for their assigned classes only
- ✅ **Bulk Operations**: Can perform bulk operations for their assigned classes
- ✅ **Own Timetable**: Can view their complete teaching schedule
- ✅ **Configuration Management**: Can create and edit their own timetable configurations

### **Parents & Students**

- ✅ **View Access**: Can view timetables for their children's classes
- ❌ **No Edit Access**: Cannot create, edit, or delete timetables

## API Endpoints

### 1. Timetable Configuration Management

#### Create Timetable Configuration

```http
POST /api/timetable/config
```

**Access**: Admin, Principal, Teachers
**Description**: Create a new timetable configuration for an academic year

**Notes:**

- Teachers can create configurations but only for academic years they have access to
- Only one active configuration per academic year

**Body:**

```json
{
  "name": "Primary School Schedule 2025-26",
  "description": "Standard timetable for primary school classes",
  "academic_year_id": "uuid",
  "total_periods": 8,
  "days_per_week": 6
}
```

**Validation Rules:**

- `name`: Required, non-empty string
- `description`: Optional string
- `academic_year_id`: Required, valid UUID
- `total_periods`: Required, integer 1-10
- `days_per_week`: Required, integer 5-7

**Response:**

```json
{
  "status": "success",
  "message": "Timetable configuration created successfully",
  "data": {
    "config": {
      "id": "uuid",
      "name": "Primary School Schedule 2025-26",
      "description": "Standard timetable for primary school classes",
      "academic_year_id": "uuid",
      "total_periods": 8,
      "days_per_week": 6,
      "is_active": true,
      "created_by": "uuid",
      "created_at": "2024-01-15T10:00:00Z"
    }
  }
}
```

**Notes:**

- Only one active configuration per academic year
- Teachers can create configurations but only for academic years they have access to

#### Get Timetable Configurations

```http
GET /api/timetable/config
```

**Access**: All authenticated users
**Description**: Get all timetable configurations

**Query Parameters:**

- `academic_year_id` (optional): Filter by academic year
- `include_inactive` (optional): Include inactive configs (default: false)

**Response:**

```json
{
  "status": "success",
  "data": {
    "configs": [
      {
        "id": "uuid",
        "name": "Primary School Schedule 2025-26",
        "description": "Standard timetable for primary school classes",
        "academic_year_id": "uuid",
        "total_periods": 8,
        "days_per_week": 6,
        "is_active": true,
        "created_by": "uuid",
        "created_at": "2024-01-15T10:00:00Z",
        "academic_year": {
          "year_name": "2025-2026"
        }
      }
    ]
  }
}
```

#### Update Timetable Configuration

```http
PUT /api/timetable/config/:id
```

**Access**: Admin, Principal, Teachers (configs they created)
**Description**: Update an existing timetable configuration

**Notes:**

- Teachers can only update configurations they created
- Admin/Principal can update any configuration

**Body:**

```json
{
  "name": "Updated Schedule Name",
  "description": "Updated description",
  "total_periods": 9,
  "days_per_week": 6
}
```

**Response:**

```json
{
  "status": "success",
  "message": "Timetable configuration updated successfully",
  "data": {
    "config": {
      "id": "uuid",
      "name": "Updated Schedule Name",
      "description": "Updated description",
      "total_periods": 9,
      "days_per_week": 6,
      "updated_at": "2024-01-15T10:00:00Z"
    }
  }
}
```

### 2. Class Timetable Entries

#### Create Single Timetable Entry

```http
POST /api/timetable/entries
```

**Access**: Admin, Principal, Teachers (for their assigned classes)
**Description**: Create a single timetable entry for a class

**Body:**

```json
{
  "config_id": "uuid",
  "class_division_id": "uuid",
  "period_number": 1,
  "day_of_week": 1,
  "subject": "English",
  "teacher_id": "uuid",
  "notes": "Bring textbooks"
}
```

**Validation Rules:**

- `config_id`: Required, valid UUID
- `class_division_id`: Required, valid UUID
- `period_number`: Required, integer 1-10 (must not exceed config total_periods)
- `day_of_week`: Required, integer 1-7 (must not exceed config days_per_week)
- `subject`: Optional string
- `teacher_id`: Optional, valid UUID

- `notes`: Optional string

**Response:**

```json
{
  "status": "success",
  "message": "Timetable entry created successfully",
  "data": {
    "entry": {
      "id": "uuid",
      "config_id": "uuid",
      "class_division_id": "uuid",
      "period_number": 1,
      "day_of_week": 1,
      "subject": "English",
      "teacher_id": "uuid",

      "notes": "Bring textbooks",
      "created_by": "uuid",
      "created_at": "2024-01-15T10:00:00Z"
    }
  }
}
```

**Notes:**

- Teachers can only create entries for classes they are assigned to
- System validates no conflicts for class/period/day combinations
- Period number must not exceed the configuration's total periods
- Day of week must not exceed the configuration's days per week
- Teachers must be assigned to the class via `class_teacher_assignments` table

#### Create Bulk Timetable Entries

```http
POST /api/timetable/bulk-entries
```

**Access**: Admin, Principal, Teachers (for their assigned classes)
**Description**: Create multiple timetable entries at once

**Body:**

```json
{
  "config_id": "uuid",
  "class_division_id": "uuid",
  "entries": [
    {
      "period_number": 1,
      "day_of_week": 1,
      "subject": "English",
      "teacher_id": "uuid"
    },
    {
      "period_number": 2,
      "day_of_week": 1,
      "subject": "Kannada",
      "teacher_id": "uuid"
    },
    {
      "period_number": 3,
      "day_of_week": 1,
      "subject": "Mathematics",
      "teacher_id": "uuid"
    }
  ]
}
```

**Response:**

```json
{
  "status": "success",
  "message": "3 timetable entries created successfully",
  "data": {
    "entries": [
      {
        "id": "uuid",
        "period_number": 1,
        "day_of_week": 1,
        "subject": "English"
      },
      {
        "id": "uuid",
        "period_number": 2,
        "day_of_week": 1,
        "subject": "Kannada"
      },
      {
        "id": "uuid",
        "period_number": 3,
        "day_of_week": 1,
        "subject": "Mathematics"
      }
    ]
  }
}
```

**Notes:**

- Perfect for setting up complete weekly schedules
- All entries are validated before creation
- Teachers can only create entries for their assigned classes
- Teachers must be assigned to the class via `class_teacher_assignments` table

#### Get Class Timetable

```http
GET /api/timetable/class/:class_division_id
```

**Access**: All authenticated users
**Description**: Get complete timetable for a specific class

**Query Parameters:**

- `config_id` (optional): Filter by specific configuration
- `academic_year_id` (optional): Filter by academic year

**Response:**

```json
{
  "status": "success",
  "data": {
    "class_division_id": "uuid",
    "timetable": {
      "Monday": [
        {
          "id": "uuid",
          "period_number": 1,
          "day_of_week": 1,
          "subject": "English",
          "teacher": {
            "id": "uuid",
            "full_name": "Teacher Name",
            "role": "teacher"
          },

          "notes": "Bring textbooks"
        },
        {
          "id": "uuid",
          "period_number": 2,
          "day_of_week": 1,
          "subject": "Kannada",
          "teacher": {
            "id": "uuid",
            "full_name": "Teacher Name",
            "role": "teacher"
          }
        }
      ],
      "Tuesday": [
        {
          "id": "uuid",
          "period_number": 1,
          "day_of_week": 2,
          "subject": "English"
        }
      ]
    },
    "total_entries": 15
  }
}
```

**Notes:**

- Organized by day names (Monday, Tuesday, etc.)
- Periods are sorted by period number within each day
- Teachers can only view timetables for their assigned classes
- Parents can view timetables for their children's classes

#### Get Teacher Timetable

```http
GET /api/timetable/teacher/:teacher_id
```

**Access**: Teachers (own timetable), Admin, Principal (any teacher)
**Description**: Get complete teaching schedule for a teacher

**Query Parameters:**

- `config_id` (optional): Filter by specific configuration
- `academic_year_id` (optional): Filter by academic year

**Response:**

```json
{
  "status": "success",
  "data": {
    "teacher": {
      "id": "uuid",
      "full_name": "Teacher Name",
      "role": "teacher"
    },
    "timetable": {
      "Monday": [
        {
          "id": "uuid",
          "period_number": 1,
          "day_of_week": 1,
          "subject": "English",
          "class_division": {
            "id": "uuid",
            "division": "A",
            "class_level": {
              "name": "Grade 1"
            }
          }
        }
      ]
    },
    "total_entries": 20
  }
}
```

**Notes:**

- Teachers can only view their own timetable
- Admin/Principal can view any teacher's timetable
- Shows all classes and subjects the teacher teaches

#### Update Timetable Entry

```http
PUT /api/timetable/entries/:id
```

**Access**: Admin, Principal, Teachers (for their assigned classes)
**Description**: Update an existing timetable entry

**Body:**

```json
{
  "subject": "Advanced English",
  "teacher_id": "uuid",
  "notes": "Updated notes"
}
```

**Response:**

```json
{
  "status": "success",
  "message": "Timetable entry updated successfully",
  "data": {
    "entry": {
      "id": "uuid",
      "subject": "Advanced English",
      "teacher_id": "uuid",

      "notes": "Updated notes",
      "updated_at": "2024-01-15T10:00:00Z"
    }
  }
}
```

**Notes:**

- Teachers can only update entries for their assigned classes
- All fields are optional (partial updates supported)
- Teachers must be assigned to the class via `class_teacher_assignments` table

#### Delete Timetable Entry

```http
DELETE /api/timetable/entries/:id
```

**Access**: Admin, Principal, Teachers (for their assigned classes)
**Description**: Delete a timetable entry

**Response:**

```json
{
  "status": "success",
  "message": "Timetable entry deleted successfully"
}
```

**Notes:**

- Soft delete (sets `is_active = false`)
- Teachers can only delete entries for their assigned classes
- Teachers must be assigned to the class via `class_teacher_assignments` table

## Data Models

### Timetable Configuration

```sql
CREATE TABLE timetable_config (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name text NOT NULL,
    description text,
    academic_year_id uuid NOT NULL REFERENCES academic_years(id),
    total_periods integer NOT NULL CHECK (total_periods > 0 AND total_periods <= 10),
    days_per_week integer NOT NULL DEFAULT 6 CHECK (days_per_week >= 5 AND days_per_week <= 7),
    is_active boolean NOT NULL DEFAULT true,
    created_by uuid REFERENCES users(id),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),

    -- Only one active configuration per academic year (enforced by partial unique index)
);
```

### Class Timetable

```sql
CREATE TABLE class_timetable (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_id uuid NOT NULL REFERENCES timetable_config(id),
    class_division_id uuid NOT NULL REFERENCES class_divisions(id),
    period_number integer NOT NULL CHECK (period_number > 0 AND period_number <= 10),
    day_of_week integer NOT NULL CHECK (day_of_week >= 1 AND day_of_week <= 7),
    subject text,
    teacher_id uuid REFERENCES users(id),
    room_number text,
    notes text,
    is_active boolean NOT NULL DEFAULT true,
    created_by uuid REFERENCES users(id),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),

    -- No conflicts: one subject per class per period per day (enforced by partial unique index)
    -- No teacher conflicts: one teacher per period per day (enforced by partial unique index)
);
```

## Usage Examples

### 1. Setting Up a New Academic Year Timetable

**Step 1: Create Configuration**

```bash
POST /api/timetable/config
{
  "name": "2025-26 Primary Schedule",
  "academic_year_id": "academic-year-uuid",
  "total_periods": 8,
  "days_per_week": 6
}
```

**Step 2: Create Bulk Entries for Grade 1A**

```bash
POST /api/timetable/bulk-entries
{
  "config_id": "config-uuid",
  "class_division_id": "grade1a-uuid",
  "entries": [
    {"period_number": 1, "day_of_week": 1, "subject": "English"},
    {"period_number": 2, "day_of_week": 1, "subject": "Kannada"},
    {"period_number": 3, "day_of_week": 1, "subject": "Mathematics"},
    {"period_number": 4, "day_of_week": 1, "subject": "Science"},
    {"period_number": 1, "day_of_week": 2, "subject": "English"},
    {"period_number": 2, "day_of_week": 2, "subject": "Kannada"}
  ]
}
```

### 2. Teacher Viewing Their Schedule

```bash
GET /api/timetable/teacher/teacher-uuid
```

**Response shows:**

- Monday: Period 1 (English - Grade 1A), Period 3 (Mathematics - Grade 2B)
- Tuesday: Period 2 (English - Grade 1A), Period 4 (Mathematics - Grade 3C)
- etc.

### 3. Parent Viewing Child's Schedule

```bash
GET /api/timetable/class/grade1a-uuid
```

**Response shows:**

- Monday: Period 1 (English), Period 2 (Kannada), Period 3 (Mathematics)
- Tuesday: Period 1 (English), Period 2 (Kannada), Period 3 (Science)
- etc.

## Error Handling

### Common Error Responses

**Validation Error:**

```json
{
  "status": "error",
  "message": "Validation failed",
  "errors": [
    {
      "field": "period_number",
      "message": "Period number must be between 1 and 10"
    }
  ]
}
```

**Conflict Error:**

```json
{
  "status": "error",
  "message": "Conflict: Mathematics already assigned for this class, period, and day"
}
```

**Permission Error:**

```json
{
  "status": "error",
  "message": "You can only manage timetables for your assigned classes"
}
```

**Not Found Error:**

```json
{
  "status": "error",
  "message": "Timetable configuration not found"
}
```

## Best Practices

### 1. **Start with Configuration**

- Always create timetable configuration first
- Set appropriate total periods and days per week
- Only one active configuration per academic year

### 2. **Use Bulk Operations**

- Use `bulk-entries` for initial setup
- Create complete weekly schedules at once
- Reduces API calls and ensures consistency

### 3. **Validate Teacher Assignments**

- Ensure teachers are assigned to classes before creating timetables
- Check for teacher conflicts (same teacher, same period, same day)
- Use the teacher assignment system for proper class-teacher relationships

### 4. **Period Numbering**

- Use sequential numbers (1, 2, 3, 4...)
- Don't skip numbers unless intentional
- Keep period numbers consistent across days

### 5. **Subject Naming**

- Use consistent subject names
- Consider using subject codes for shorter entries
- Include special periods (Assembly, Break, Lunch) as subjects

## Migration from Old System

If you're migrating from the old complex timetable system:

1. **Export existing data** from old tables
2. **Create new configuration** with appropriate periods and days
3. **Map old periods** to new period numbers
4. **Use bulk operations** to recreate timetables
5. **Test thoroughly** before switching over

## Performance Considerations

- **Indexes**: All tables have proper indexes for fast queries
- **Soft Deletes**: Uses `is_active` flag for data retention
- **Bulk Operations**: Optimized for creating multiple entries
- **Caching**: Consider caching frequently accessed timetables

## Security Features

- **Row Level Security**: Teachers can only access their assigned classes
- **Input Validation**: Comprehensive validation for all inputs
- **Conflict Prevention**: Prevents overlapping assignments
- **Audit Trail**: Tracks who created/modified entries
- **Role-Based Access**: Different permissions for different user types
- **Teacher Assignment Validation**: Teachers must be assigned to classes via either `class_teacher_assignments` table or legacy `class_divisions.teacher_id`
- **Configuration Ownership**: Teachers can only edit configurations they created
