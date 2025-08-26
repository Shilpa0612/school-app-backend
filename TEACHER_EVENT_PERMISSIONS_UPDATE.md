# Teacher Event Permissions Update

## Overview

Updated the calendar event creation system to allow teachers to create both school-wide and class-specific events, in addition to their existing ability to create teacher-specific events.

## Changes Made

### 1. Updated Access Control Logic

**File:** `src/routes/calendar.js`

**Before:**

```javascript
// Access control
if (
  event_type === "school_wide" &&
  !["admin", "principal"].includes(req.user.role)
) {
  return res.status(403).json({
    status: "error",
    message: "Only admin and principal can create school-wide events",
  });
}
```

**After:**

```javascript
// Access control for school-wide events
if (
  event_type === "school_wide" &&
  !["admin", "principal", "teacher"].includes(req.user.role)
) {
  return res.status(403).json({
    status: "error",
    message:
      "Only admin, principal, and teachers can create school-wide events",
  });
}
```

### 2. Enhanced Debugging

Added comprehensive logging to help debug teacher assignment validation issues:

```javascript
console.log(
  `🔍 Checking teacher assignment for teacher ${req.user.id} and class ${class_division_id}`
);
console.log(`📊 Teacher assignments query result:`, {
  data: teacherAssignments,
  error: assignmentError,
  count: teacherAssignments?.length || 0,
});
```

## Current Event Creation Permissions

### Admin & Principal

- ✅ **School-wide events**: Can create (auto-approved)
- ✅ **Class-specific events**: Can create for any class (auto-approved)
- ✅ **Teacher-specific events**: Can create (auto-approved)

### Teachers

- ✅ **School-wide events**: Can create (pending approval)
- ✅ **Class-specific events**: Can create for assigned classes only (pending approval)
- ✅ **Teacher-specific events**: Can create (pending approval)

### Parents & Students

- ❌ **All event types**: Cannot create any events

## Event Approval Workflow

### For Teacher-Created Events

1. **Teacher creates event** → Status: `pending`
2. **Principal/Admin reviews** the event
3. **Principal/Admin approves/rejects** the event
4. **Event becomes visible** to all users (if approved)

### For Admin/Principal-Created Events

- Events are **auto-approved** and immediately visible

## Testing

### Test Scripts Created

1. **`test_teacher_event_permissions.js`** - Tests teacher permissions for all event types
2. **`debug_teacher_assignment.js`** - Debugs teacher assignment validation issues

### Key Test Cases

- ✅ Teacher creating school-wide events
- ✅ Teacher creating class-specific events (for assigned classes)
- ✅ Teacher creating teacher-specific events
- ✅ Proper approval workflow
- ✅ Event visibility in listings

## API Examples

### Create School-Wide Event (Teacher)

```http
POST /api/calendar/events
Authorization: Bearer <teacher-token>
Content-Type: application/json

{
  "title": "School Sports Day",
  "description": "Annual school sports day for all students",
  "event_date": "2025-08-15T09:00:00.000Z",
  "event_type": "school_wide",
  "is_single_day": true,
  "start_time": "09:00:00",
  "end_time": "16:00:00",
  "event_category": "sports",
  "timezone": "Asia/Kolkata"
}
```

### Create Class-Specific Event (Teacher)

```http
POST /api/calendar/events
Authorization: Bearer <teacher-token>
Content-Type: application/json

{
  "title": "Grade 1 B Parent Meeting",
  "description": "Parent-teacher meeting for Grade 1 B students",
  "event_date": "2025-08-10T14:00:00.000Z",
  "event_type": "class_specific",
  "class_division_id": "d5e2c45b-bce9-45c2-bb4e-caa6add083e1",
  "is_single_day": true,
  "start_time": "14:00:00",
  "end_time": "15:00:00",
  "event_category": "meeting",
  "timezone": "Asia/Kolkata"
}
```

## Response Format

### Successful Creation

```json
{
  "status": "success",
  "message": "Event created successfully and is pending approval",
  "data": {
    "event": {
      "id": "event-uuid",
      "title": "Event Title",
      "event_type": "school_wide",
      "status": "pending",
      "created_by": "teacher-uuid"
    },
    "approval_status": "pending",
    "requires_approval": true
  }
}
```

### Error Response (Unauthorized)

```json
{
  "status": "error",
  "message": "Only admin, principal, and teachers can create school-wide events"
}
```

## Debugging Teacher Assignment Issues

If a teacher is getting "You can only create events for your assigned classes" error:

1. **Check the debug logs** - The system now logs detailed information about teacher assignment queries
2. **Run the debug script** - Use `debug_teacher_assignment.js` to test the specific teacher and class
3. **Verify database data** - Ensure the teacher is properly assigned in `class_teacher_assignments` table
4. **Check UUID formats** - Ensure teacher_id and class_division_id are in correct UUID format

## Database Requirements

### Teacher Assignment Table

```sql
-- Ensure teacher is assigned to the class
SELECT * FROM class_teacher_assignments
WHERE teacher_id = 'teacher-uuid'
AND class_division_id = 'class-uuid'
AND is_active = true;
```

### Expected Result

Should return at least one row for the teacher to be able to create class-specific events.

## Next Steps

1. **Test the changes** using the provided test scripts
2. **Monitor the logs** for any teacher assignment issues
3. **Verify approval workflow** works correctly for teacher-created events
4. **Update frontend** to reflect new teacher permissions
5. **Train users** on the new event creation capabilities

## Files Modified

- `src/routes/calendar.js` - Updated access control and added debugging
- `test_teacher_event_permissions.js` - New test script
- `debug_teacher_assignment.js` - New debug script
- `TEACHER_EVENT_PERMISSIONS_UPDATE.md` - This documentation
