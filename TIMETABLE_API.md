# Timetable Management API Documentation

## Overview

The Timetable Management system provides comprehensive functionality for managing school timetables, including periods, class schedules, teacher assignments, and template-based timetable creation.

## Base URL

```
http://localhost:3000/api/timetable

Deployed URL:
https://school-app-backend-d143b785b631.herokuapp.com/api/timetable
```

## Database Schema

### Tables

1. **periods** - Defines time periods in a school day
2. **time_slots** - Maps periods to days of the week
3. **timetable_entries** - Actual class schedule entries
4. **timetable_templates** - Reusable timetable templates
5. **template_entries** - Template schedule entries

## API Endpoints

### 1. Periods Management

#### Create Period

```http
POST /api/timetable/periods
```

**Authorization**: Admin, Principal

**Body**:

```json
{
  "name": "Period 1",
  "start_time": "08:15:00",
  "end_time": "09:00:00",
  "period_type": "academic",
  "sequence_number": 2
}
```

**Period Types**:

- `academic` - Regular teaching period
- `break` - Short break
- `lunch` - Lunch break
- `assembly` - Assembly period
- `other` - Other activities

**Response**:

```json
{
  "status": "success",
  "data": {
    "period": {
      "id": "uuid",
      "name": "Period 1",
      "start_time": "08:15:00",
      "end_time": "09:00:00",
      "period_type": "academic",
      "sequence_number": 2,
      "is_active": true,
      "created_at": "2024-01-01T00:00:00Z"
    }
  }
}
```

#### Get All Periods

```http
GET /api/timetable/periods
```

**Query Parameters**:

- `include_inactive` - Include inactive periods (true/false, default: false)

**Response**:

```json
{
  "status": "success",
  "data": {
    "periods": [
      {
        "id": "uuid",
        "name": "Assembly",
        "start_time": "08:00:00",
        "end_time": "08:15:00",
        "period_type": "assembly",
        "sequence_number": 1,
        "is_active": true
      }
    ]
  }
}
```

#### Update Period

```http
PUT /api/timetable/periods/:id
```

**Authorization**: Admin, Principal

**Body** (all fields optional):

```json
{
  "name": "Updated Period 1",
  "start_time": "08:20:00",
  "end_time": "09:05:00",
  "period_type": "academic",
  "sequence_number": 3,
  "is_active": true
}
```

#### Delete Period

```http
DELETE /api/timetable/periods/:id
```

**Authorization**: Admin, Principal

**Note**: Soft delete - sets `is_active` to false. Cannot delete periods used in timetables.

### 2. Timetable Management

#### Create Timetable Entry

```http
POST /api/timetable/entries
```

**Authorization**: Admin, Principal

**Body**:

```json
{
  "class_division_id": "uuid",
  "academic_year_id": "uuid",
  "period_id": "uuid",
  "day_of_week": 1,
  "subject": "Mathematics",
  "teacher_id": "uuid",
  "notes": "Additional notes"
}
```

**Day of Week**:

- 1 = Monday
- 2 = Tuesday
- 3 = Wednesday
- 4 = Thursday
- 5 = Friday
- 6 = Saturday

**Note**: Weekdays (Monday to Saturday) are supported for timetables.

**Response**:

```json
{
  "status": "success",
  "data": {
    "timetable_entry": {
      "id": "uuid",
      "class_division_id": "uuid",
      "academic_year_id": "uuid",
      "period_id": "uuid",
      "day_of_week": 1,
      "subject": "Mathematics",
      "teacher_id": "uuid",
      "notes": "Additional notes",
      "period": {
        "id": "uuid",
        "name": "Period 1",
        "start_time": "08:15:00",
        "end_time": "09:00:00",
        "period_type": "academic"
      },
      "teacher": {
        "id": "uuid",
        "full_name": "Teacher Name"
      },
      "class_division": {
        "id": "uuid",
        "division": "A",
        "class_level": {
          "name": "Grade 1"
        }
      }
    }
  }
}
```

#### Get Class Timetable

```http
GET /api/timetable/class/:class_division_id
```

**Authorization**: All authenticated users (with access control)

**Query Parameters**:

- `day_of_week` - Filter by specific day (0-6)

**Response**:

```json
{
  "status": "success",
  "data": {
    "class_division": {
      "id": "uuid",
      "division": "A",
      "class_level": {
        "name": "Grade 1"
      },
      "academic_year": {
        "year_name": "2024-2025"
      }
    },
    "timetable": {
      "1": {
        "day_name": "Monday",
        "day_number": 1,
        "entries": [
          {
            "id": "uuid",
            "subject": "Mathematics",
            "teacher": {
              "id": "uuid",
              "full_name": "Teacher Name"
            },
            "period": {
              "id": "uuid",
              "name": "Period 1",
              "start_time": "08:15:00",
              "end_time": "09:00:00",
              "period_type": "academic",
              "sequence_number": 2
            },
            "notes": "Additional notes"
          }
        ]
      }
    },
    "total_entries": 1
  }
}
```

#### Get Teacher Timetable

```http
GET /api/timetable/teacher/:teacher_id
```

**Authorization**: All authenticated users (teachers can only view their own)

**Query Parameters**:

- `day_of_week` - Filter by specific day (0-6)

**Response**:

```json
{
  "status": "success",
  "data": {
    "teacher": {
      "id": "uuid",
      "full_name": "Teacher Name"
    },
    "timetable": {
      "1": {
        "day_name": "Monday",
        "day_number": 1,
        "entries": [
          {
            "id": "uuid",
            "subject": "Mathematics",
            "period": {
              "id": "uuid",
              "name": "Period 1",
              "start_time": "08:15:00",
              "end_time": "09:00:00",
              "period_type": "academic",
              "sequence_number": 2
            },
            "class_division": {
              "id": "uuid",
              "division": "A",
              "class_level": {
                "name": "Grade 1"
              },
              "academic_year": {
                "year_name": "2024-2025"
              }
            },
            "notes": "Additional notes"
          }
        ]
      }
    },
    "total_entries": 1
  }
}
```

#### Update Timetable Entry

```http
PUT /api/timetable/entries/:id
```

**Authorization**: Admin, Principal

**Body** (all fields optional):

```json
{
  "subject": "Updated Mathematics",
  "teacher_id": "uuid",
  "notes": "Updated notes"
}
```

#### Delete Timetable Entry

```http
DELETE /api/timetable/entries/:id
```

**Authorization**: Admin, Principal

**Note**: Soft delete - sets `is_active` to false.

### 3. Template Management

#### Create Timetable Template

```http
POST /api/timetable/templates
```

**Authorization**: Admin, Principal

**Body**:

```json
{
  "name": "Standard Primary Template",
  "description": "Standard timetable for primary classes",
  "academic_year_id": "uuid",
  "class_level_id": "uuid"
}
```

#### Get All Templates

```http
GET /api/timetable/templates
```

**Query Parameters**:

- `include_inactive` - Include inactive templates (true/false, default: false)

**Response**:

```json
{
  "status": "success",
  "data": {
    "templates": [
      {
        "id": "uuid",
        "name": "Standard Primary Template",
        "description": "Standard timetable for primary classes",
        "academic_year": {
          "year_name": "2024-2025"
        },
        "class_level": {
          "name": "Grade 1"
        },
        "creator": {
          "full_name": "Admin Name"
        },
        "is_active": true,
        "created_at": "2024-01-01T00:00:00Z"
      }
    ]
  }
}
```

#### Apply Template to Class

```http
POST /api/timetable/templates/:template_id/apply/:class_division_id
```

**Authorization**: Admin, Principal

**Response**:

```json
{
  "status": "success",
  "data": {
    "template": {
      "id": "uuid",
      "name": "Standard Primary Template"
    },
    "applied_entries": [
      {
        "id": "uuid",
        "subject": "Mathematics",
        "period": {
          "name": "Period 1",
          "start_time": "08:15:00",
          "end_time": "09:00:00"
        }
      }
    ],
    "total_entries": 1
  },
  "message": "Template applied successfully. 1 entries created."
}
```

## Access Control

### Admin/Principal

- Full access to all endpoints
- Can create, update, and delete periods, timetables, and templates
- Can apply templates to classes

### Teachers

- Can view timetables for their assigned classes
- Can view their own timetable
- Cannot modify timetables

### Parents

- Can view timetables for their children's classes
- Cannot modify timetables

## Conflict Prevention

The system automatically prevents:

1. **Period Conflicts**: No overlapping time periods
2. **Class Conflicts**: One subject per class per period per day
3. **Teacher Conflicts**: One teacher per period per day (optional constraint)
4. **Template Conflicts**: Validates template entries before application

## Default Periods

The system comes with pre-configured periods:

- Assembly (08:00-08:15)
- Period 1 (08:15-09:00)
- Period 2 (09:00-09:45)
- Break (09:45-10:00)
- Period 3 (10:00-10:45)
- Period 4 (10:45-11:30)
- Lunch Break (11:30-12:15)
- Period 5 (12:15-13:00)
- Period 6 (13:00-13:45)
- Period 7 (13:45-14:30)
- Period 8 (14:30-15:15)

## Notes Field Usage

The `notes` field can be used for:

- **Special Instructions**: "Bring lab equipment", "Computer lab required"
- **Substitute Teacher Info**: "Covered by Mrs. Smith"
- **Special Events**: "Sports day preparation", "Exam week"
- **Room Changes**: "Temporary move to Room 102"
- **Subject Variations**: "Advanced Mathematics", "Remedial English"
- **Administrative Notes**: "Parent meeting after class", "Staff meeting"

## Usage Examples

### 1. Create a Complete Timetable for a Class

```bash
# 1. Get available periods
GET /api/timetable/periods

# 2. Get available teachers
GET /api/academic/teachers

# 3. Create timetable entries for each day
POST /api/timetable/entries
{
  "class_division_id": "uuid",
  "period_id": "uuid",
  "day_of_week": 1,
  "subject": "Mathematics",
  "teacher_id": "uuid"
}
```

### 2. View Class Timetable

```bash
# Get full week timetable
GET /api/timetable/class/uuid

# Get specific day timetable
GET /api/timetable/class/uuid?day_of_week=1
```

### 3. View Teacher Timetable

```bash
# Get teacher's full week schedule
GET /api/timetable/teacher/uuid

# Get teacher's Monday schedule
GET /api/timetable/teacher/uuid?day_of_week=1
```

### 4. Use Templates

```bash
# 1. Create template
POST /api/timetable/templates
{
  "name": "Primary Template",
  "description": "Standard primary class schedule"
}

# 2. Apply template to class
POST /api/timetable/templates/uuid/apply/uuid
```

## Error Handling

Common error responses:

```json
{
  "status": "error",
  "message": "Timetable entry already exists for this class, period, and day",
  "existing_entry": {
    "id": "uuid",
    "subject": "Mathematics",
    "teacher_id": "uuid"
  }
}
```

```json
{
  "status": "error",
  "message": "Teacher is already assigned to another class during this period",
  "teacher_conflict": {
    "id": "uuid",
    "class_division_id": "uuid",
    "subject": "Science"
  }
}
```

## Migration

To set up the timetable system, run the migration:

```sql
-- Run the migration file
\i migrations/create_timetable_system.sql
```

This will create all necessary tables and insert default periods.
