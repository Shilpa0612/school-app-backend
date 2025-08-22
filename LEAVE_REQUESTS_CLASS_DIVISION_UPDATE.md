# Leave Requests API - Class Division Enhancement

## Overview

The leave requests API has been enhanced to include class division information in all responses. This allows users to see which class and division a student belongs to when viewing leave requests.

## Changes Made

### 1. Enhanced GET /leave-requests Endpoint

- **Before**: Only returned basic student information (id, full_name, admission_number)
- **After**: Now includes complete class division information through student academic records

**New Response Structure:**

```json
{
  "status": "success",
  "data": {
    "leave_requests": [
      {
        "id": "uuid",
        "student_id": "uuid",
        "start_date": "2024-01-15",
        "end_date": "2024-01-16",
        "reason": "Medical appointment",
        "status": "pending",
        "created_at": "2024-01-10T10:00:00Z",
        "student": {
          "id": "uuid",
          "full_name": "John Doe",
          "admission_number": "2024001",
          "student_academic_records": [
            {
              "class_division": {
                "id": "uuid",
                "division": "A",
                "level": {
                  "id": "uuid",
                  "name": "Class 10",
                  "sequence_number": 10
                }
              },
              "roll_number": 15
            }
          ]
        }
      }
    ]
  }
}
```

### 2. Enhanced POST /leave-requests Endpoint

- **Before**: Returned only the created leave request data
- **After**: Returns the leave request with complete student and class division information

### 3. Enhanced PUT /leave-requests/:id/status Endpoint

- **Before**: Returned only the updated leave request data
- **After**: Returns the updated leave request with complete student and class division information

### 4. Enhanced GET /leave-requests/my-children Endpoint

- **Before**: Already included class division information
- **After**: Maintains the same enhanced structure with class division details

## Class Division Information Structure

The class division information includes:

- **class_division.id**: Unique identifier for the class division
- **class_division.division**: Division name (e.g., "A", "B", "C")
- **class_division.level.id**: Unique identifier for the class level
- **class_division.level.name**: Class name (e.g., "Class 10", "Class 9")
- **class_division.level.sequence_number**: Numeric sequence for ordering
- **roll_number**: Student's roll number in the class

## Filtering by Class Division

The API already supported filtering by class division using the `class_division_id` query parameter:

```
GET /api/leave-requests?class_division_id=uuid
```

This filter returns leave requests only for students in the specified class division.

## Database Relationships

The enhancement leverages existing database relationships:

- `leave_requests.student_id` → `students_master.id`
- `students_master.id` → `student_academic_records.student_id`
- `student_academic_records.class_division_id` → `class_divisions.id`
- `class_divisions.class_level_id` → `class_levels.id`

## Benefits

1. **Better Context**: Users can immediately see which class a student belongs to when viewing leave requests
2. **Improved Filtering**: Teachers and administrators can filter leave requests by class division
3. **Enhanced UI**: Frontend applications can display class information alongside leave request details
4. **Consistent Data**: All leave request endpoints now return consistent, complete information

## API Endpoints Summary

| Endpoint                      | Method | Class Division Info | Filtering Support    |
| ----------------------------- | ------ | ------------------- | -------------------- |
| `/leave-requests`             | GET    | ✅ Included         | ✅ class_division_id |
| `/leave-requests`             | POST   | ✅ Included         | N/A                  |
| `/leave-requests/:id/status`  | PUT    | ✅ Included         | N/A                  |
| `/leave-requests/my-children` | GET    | ✅ Included         | ✅ class_division_id |

## Testing

A test script `test_leave_requests_api.js` has been created to verify:

- All endpoints return class division information
- Filtering by class division works correctly
- Response structures are consistent across endpoints

Run the test with:

```bash
node test_leave_requests_api.js
```

## Backward Compatibility

All changes are backward compatible:

- Existing API calls will continue to work
- New class division information is additive and doesn't break existing functionality
- Optional query parameters remain optional
