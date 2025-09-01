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

This enhancement ensures that API consumers receive specific, actionable error information instead of generic 500 errors, making debugging and user experience significantly better.
