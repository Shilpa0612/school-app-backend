# Timetable API Error Handling Enhancement

## Problem Solved

The timetable entries POST endpoint (`/api/timetable/entries`) was returning generic **500 Internal Server Error** responses without specific details about what went wrong. This made debugging difficult and provided poor user experience.

## Solution Implemented

### ✅ Enhanced Error Responses

Instead of generic 500 errors, the API now returns specific, actionable error information:

```json
{
  "status": "error",
  "message": "Specific error description",
  "details": "Detailed explanation of what went wrong",
  "error_code": "DATABASE_ERROR_CODE",
  "error_type": "ErrorType",
  "suggestion": "Actionable suggestion to fix the issue",
  "timestamp": "2024-01-15T10:30:00Z",
  "endpoint": "POST /api/timetable/entries"
}
```

### ✅ Specific Error Handling

#### 1. **Database Constraint Violations**

**Duplicate Entry (Error Code: 23505)**

```json
{
  "status": "error",
  "message": "Duplicate entry conflict",
  "details": "A timetable entry already exists for this class, period, and day combination",
  "error_code": "23505",
  "suggestion": "Please check existing timetable entries or modify the period/day selection"
}
```

**Invalid Reference IDs (Error Code: 23503)**

```json
{
  "status": "error",
  "message": "Invalid reference data",
  "details": "One or more referenced IDs (config_id, class_division_id, teacher_id) are invalid or do not exist",
  "error_code": "23503",
  "suggestion": "Please verify that all IDs exist and are valid"
}
```

**Invalid UUID Format (Error Code: 22P02)**

```json
{
  "status": "error",
  "message": "Invalid ID format",
  "details": "One or more IDs are not in valid UUID format",
  "error_code": "22P02",
  "suggestion": "Please ensure all IDs are valid UUIDs"
}
```

#### 2. **Validation Errors**

**Missing Required Fields**

```json
{
  "status": "error",
  "message": "Validation failed",
  "details": "Some fields failed validation",
  "errors": [
    {
      "msg": "Valid config ID is required",
      "param": "config_id",
      "location": "body"
    }
  ],
  "suggestion": "Please correct the validation errors and try again"
}
```

#### 3. **Authentication/Authorization Errors**

```json
{
  "status": "error",
  "message": "Authentication error",
  "details": "JWT token is invalid or expired",
  "suggestion": "Please check your authentication credentials"
}
```

#### 4. **Resource Not Found (Error Code: PGRST116)**

```json
{
  "status": "error",
  "message": "Resource not found",
  "details": "The specified timetable configuration or class division was not found",
  "error_code": "PGRST116",
  "suggestion": "Please verify the config_id and class_division_id exist and are active"
}
```

### ✅ Enhanced Logging

The server now logs comprehensive error information for debugging:

```javascript
logger.error("Error creating timetable entry:", {
  error: error.message,
  stack: error.stack,
  code: error.code,
  details: error.details,
  hint: error.hint,
  body: req.body,
  user: req.user?.id,
});
```

### ✅ Environment-Aware Responses

- **Development**: Full error details including stack traces
- **Production**: User-friendly messages without sensitive information

## Files Modified

1. **`src/routes/timetable.js`**
   - Enhanced error handling in POST `/entries` endpoint
   - Specific error cases with detailed responses
   - Comprehensive logging

2. **`src/middleware/errorHandler.js`**
   - Global error handler improvements
   - Database error code mapping
   - Enhanced error response structure

## Testing

Use the provided test script `test_timetable_error_handling.js` to verify different error scenarios:

```bash
node test_timetable_error_handling.js
```

## Benefits

### 🔍 **Better Debugging**

- Specific error codes for programmatic handling
- Detailed error descriptions
- Enhanced server-side logging

### 👥 **Improved User Experience**

- Clear, actionable error messages
- Helpful suggestions for fixing issues
- Proper HTTP status codes

### 🛠️ **Developer Experience**

- Easy identification of issues
- Reduced debugging time
- Clear error categorization

## Common Error Scenarios & Solutions

| Error Code | Cause                     | Solution                                  |
| ---------- | ------------------------- | ----------------------------------------- |
| `23505`    | Duplicate timetable entry | Check existing entries, modify period/day |
| `23503`    | Invalid reference ID      | Verify config_id, class_division_id exist |
| `22P02`    | Malformed UUID            | Ensure all IDs are valid UUIDs            |
| `PGRST116` | Resource not found        | Verify resource exists and is active      |
| Validation | Missing/invalid fields    | Check required fields and formats         |

## Example Usage

### Before Enhancement

```http
POST /api/timetable/entries
Status: 500 Internal Server Error

{
  "status": "error",
  "message": "Internal Server Error"
}
```

### After Enhancement

```http
POST /api/timetable/entries
Status: 400 Bad Request

{
  "status": "error",
  "message": "Invalid reference data",
  "details": "One or more referenced IDs (config_id, class_division_id, teacher_id) are invalid or do not exist",
  "error_code": "23503",
  "suggestion": "Please verify that all IDs exist and are valid",
  "timestamp": "2024-01-15T10:30:00Z",
  "endpoint": "POST /api/timetable/entries"
}
```

## ✅ **Enhanced Error Responses for Timetable Entries**

### **All Errors Now Return 500 Status Code**

The timetable entries endpoint (`POST /api/timetable/entries`) now returns **500 status code** for all errors with detailed, actionable information.

### **Enhanced Error Response Format**

All errors now follow this consistent format:

```json
{
  "status": "error",
  "message": "Specific error message",
  "details": "Detailed explanation of what went wrong",
  "error_code": "UNIQUE_ERROR_CODE",
  "suggestion": "Actionable suggestion to fix the issue",
  "additional_data": {} // Optional: context-specific information
}
```

## ✅ **Teacher Conflict Handling**

### **Teacher Double-Booking Prevention**

The system now prevents and properly handles teacher conflicts when the same teacher is assigned to multiple classes at the same time period.

#### **Proactive Conflict Detection**

Before inserting a new timetable entry, the API checks:

1. **Class Conflicts**: Same class, period, and day
2. **Teacher Conflicts**: Same teacher, period, and day (different classes)

#### **Teacher Conflict Response**

When a teacher is already assigned to another class at the same time:

```json
{
  "status": "error",
  "message": "Teacher schedule conflict",
  "details": "This teacher is already assigned to teach Mathematics for Grade-1A at the same time",
  "error_code": "TEACHER_CONFLICT",
  "suggestion": "Please choose a different teacher, period, or day for this assignment",
  "conflict_data": {
    "existing_subject": "Mathematics",
    "existing_class": "Grade-1A",
    "teacher_id": "teacher-uuid",
    "period_number": 2,
    "day_of_week": 1,
    "day_name": "Monday"
  }
}
```

#### **Database Constraint Fallback**

If conflicts slip through validation, the database constraint catches them:

```json
{
  "status": "error",
  "message": "Teacher schedule conflict",
  "details": "This teacher is already assigned to another class during the same period and day",
  "error_code": "TEACHER_CONFLICT_DB",
  "suggestion": "Please choose a different teacher, period, or day for this assignment",
  "constraint_violated": "unique_teacher_period_day"
}
```

## **Enhanced Timetable Entries Error Examples**

### **1. Validation Errors**

```json
{
  "status": "error",
  "message": "Validation failed",
  "details": "Some fields failed validation",
  "errors": [
    {
      "msg": "Valid config ID is required",
      "param": "config_id",
      "location": "body"
    }
  ],
  "error_code": "VALIDATION_ERROR",
  "suggestion": "Please correct the validation errors and try again"
}
```

### **2. Teacher Authorization Errors**

```json
{
  "status": "error",
  "message": "You can only manage timetables for your assigned classes",
  "details": "This teacher is not assigned to the specified class division",
  "error_code": "TEACHER_NOT_AUTHORIZED",
  "suggestion": "Please contact administration to get assigned to this class or choose a different class",
  "class_division_id": "class-uuid",
  "teacher_id": "teacher-uuid"
}
```

### **3. Configuration Errors**

```json
{
  "status": "error",
  "message": "Invalid timetable configuration",
  "details": "The specified timetable configuration does not exist or is not active",
  "error_code": "INVALID_CONFIG",
  "suggestion": "Please verify the config_id is correct and the configuration is active",
  "config_id": "config-uuid"
}
```

### **4. Period/Day Validation Errors**

```json
{
  "status": "error",
  "message": "Period number cannot exceed total periods (8)",
  "details": "The requested period 10 exceeds the maximum 8 periods configured for this timetable",
  "error_code": "PERIOD_EXCEEDS_LIMIT",
  "suggestion": "Please choose a period number between 1 and 8",
  "requested_period": 10,
  "max_periods": 8
}
```

### **5. Class Schedule Conflicts**

```json
{
  "status": "error",
  "message": "Class schedule conflict",
  "details": "Mathematics is already assigned for this class, period, and day",
  "error_code": "CLASS_CONFLICT",
  "suggestion": "Please choose a different period or day, or update the existing entry",
  "conflict_data": {
    "existing_subject": "Mathematics",
    "class_division_id": "class-uuid",
    "period_number": 2,
    "day_of_week": 1
  }
}
```

### **6. Teacher Schedule Conflicts**

```json
{
  "status": "error",
  "message": "Teacher schedule conflict",
  "details": "This teacher is already assigned to teach Science for Grade-2B at the same time",
  "error_code": "TEACHER_CONFLICT",
  "suggestion": "Please choose a different teacher, period, or day for this assignment",
  "conflict_data": "Conflict data object with existing assignment details"
}
```

### **7. Database Constraint Violations**

```json
{
  "status": "error",
  "message": "Teacher schedule conflict",
  "details": "This teacher is already assigned to another class during the same period and day",
  "error_code": "TEACHER_CONFLICT_DB",
  "suggestion": "Please choose a different teacher, period, or day for this assignment",
  "constraint_violated": "unique_teacher_period_day"
}
```

## **Testing Teacher Conflicts**

Use the provided test script `test_teacher_conflict_scenarios.js` to verify teacher conflict handling:

```bash
node test_teacher_conflict_scenarios.js
```

**Test Scenarios:**

1. Create first timetable entry for Teacher A
2. Attempt to assign same teacher to different class (same period/day)
3. Verify conflict is detected and proper error is returned
4. Test valid assignment (different period)

## **Benefits of Enhanced Error Handling**

✅ **Consistent Status Codes**: All errors return 500 instead of mixed 400/401/403/404  
✅ **Detailed Information**: Each error includes specific details about what went wrong  
✅ **Error Codes**: Unique error codes for programmatic handling  
✅ **Actionable Suggestions**: Clear guidance on how to fix the issue  
✅ **Context Data**: Additional information for debugging and UI integration  
✅ **Better User Experience**: Clear, understandable error messages

This enhancement ensures that API consumers receive specific, actionable error information instead of generic 500 errors, making debugging and user experience significantly better.
