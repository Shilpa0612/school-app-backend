# Improved Error Handling System

## Overview

The school app now has a comprehensive error handling system that provides **specific, actionable error messages** instead of generic "Internal Server Error" responses. This makes debugging and user experience much better.

## Key Improvements

### ✅ **Specific Error Messages**

- Database constraint violations are clearly identified
- Field-specific error messages
- Actionable suggestions for fixing issues

### ✅ **Better Validation**

- Enhanced input validation with detailed feedback
- Age validation for students (2-25 years)
- Format validation for phone numbers, emails, UUIDs

### ✅ **Database Error Handling**

- PostgreSQL error code mapping
- Unique constraint violation handling
- Foreign key constraint violation handling
- UUID format validation

### ✅ **User-Friendly Responses**

- Clear error messages
- Detailed explanations
- Helpful suggestions
- Field identification for UI integration

## Error Response Format

All error responses now follow this consistent format:

```json
{
  "status": "error",
  "message": "Clear error message",
  "details": "Detailed explanation of what went wrong",
  "field": "field_name", // Optional: identifies the problematic field
  "suggestion": "Actionable suggestion to fix the issue",
  "error_code": "DATABASE_ERROR_CODE", // Optional: for debugging
  "existing_data": {} // Optional: shows conflicting data
}
```

## Common Error Scenarios

### 1. **Validation Errors**

**Before:**

```json
{
  "status": "error",
  "errors": [{ "msg": "Invalid value", "param": "phone_number" }]
}
```

**After:**

```json
{
  "status": "error",
  "message": "Validation failed",
  "details": "Some fields failed validation",
  "errors": [
    {
      "field": "phone_number",
      "message": "Phone number must be exactly 10 digits",
      "value": "123"
    }
  ],
  "suggestion": "Please correct the validation errors and try again"
}
```

### 2. **Duplicate Admission Number**

**Before:**

```json
{
  "status": "error",
  "message": "Internal Server Error"
}
```

**After:**

```json
{
  "status": "error",
  "message": "Admission number already exists",
  "details": "Student \"John Smith\" already has admission number \"2024001\"",
  "field": "admission_number",
  "existing_student": {
    "id": "uuid",
    "full_name": "John Smith",
    "admission_number": "2024001"
  },
  "suggestion": "Please use a different admission number"
}
```

### 3. **Duplicate Roll Number**

**Before:**

```json
{
  "status": "error",
  "message": "Internal Server Error"
}
```

**After:**

```json
{
  "status": "error",
  "message": "Roll number already taken in this class",
  "details": "Roll number \"01\" is already assigned to student \"Jane Doe\" (2024002) in class A",
  "field": "roll_number",
  "existing_student": {
    "id": "uuid",
    "full_name": "Jane Doe",
    "admission_number": "2024002"
  },
  "class_info": {
    "division": "A",
    "level": "Grade 1"
  },
  "suggestion": "Please use a different roll number for this class"
}
```

### 4. **Invalid Class Division**

**Before:**

```json
{
  "status": "error",
  "message": "Internal Server Error"
}
```

**After:**

```json
{
  "status": "error",
  "message": "Class division not found",
  "details": "No class division found with ID: 91d1cd06-a896-4409-81a5-8fcd2b64e4b0",
  "field": "class_division_id",
  "suggestion": "Please verify the class division ID or create the class division first"
}
```

### 5. **Duplicate Phone Number**

**Before:**

```json
{
  "status": "error",
  "message": "Internal Server Error"
}
```

**After:**

```json
{
  "status": "error",
  "message": "Phone number already registered",
  "details": "Phone number \"1234567890\" is already registered by \"John Smith\"",
  "field": "phone_number",
  "existing_parent": {
    "id": "uuid",
    "full_name": "John Smith",
    "phone_number": "1234567890",
    "is_registered": true
  },
  "suggestion": "This parent is already registered. Please use a different phone number."
}
```

## Enhanced Validation Rules

### **Student Creation Validation**

```javascript
// Admission number
- Required
- 1-50 characters
- Must be unique

// Full name
- Required
- 2-100 characters

// Date of birth
- Required
- Valid date format (YYYY-MM-DD)
- Age must be between 2-25 years

// Admission date
- Required
- Valid date format (YYYY-MM-DD)

// Class division ID
- Required
- Valid UUID format
- Must exist in database

// Roll number
- Required
- 1-10 characters
- Must be unique within class

// Gender
- Optional
- Must be: male, female, other

// Address
- Optional
- Max 500 characters

// Emergency contact
- Optional
- Exactly 10 digits
```

### **Parent Creation Validation**

```javascript
// Full name
- Required
- 2-100 characters

// Phone number
- Required
- Exactly 10 digits
- Must be unique

// Email
- Optional
- Valid email format
- Normalized (lowercase)

// Initial password
- Optional
- Minimum 6 characters
```

## Database Error Code Mapping

The system now handles these PostgreSQL error codes:

| Error Code | Description                      | User-Friendly Message                  |
| ---------- | -------------------------------- | -------------------------------------- |
| `23505`    | Unique constraint violation      | "Already exists" with field details    |
| `23503`    | Foreign key constraint violation | "Invalid reference" with field details |
| `22P02`    | Invalid UUID                     | "Invalid ID format"                    |
| `23502`    | Not null violation               | "Required field missing"               |
| `23514`    | Check constraint violation       | "Invalid data value"                   |
| `PGRST116` | No rows returned (Supabase)      | "Record not found"                     |

## Usage Examples

### **Using the Error Handler Utility**

```javascript
import { ErrorResponses } from "../utils/errorHandler.js";

// Handle validation errors
if (!errors.isEmpty()) {
  return ErrorResponses.validationError(res, errors.array());
}

// Handle database errors
if (databaseError) {
  return ErrorResponses.databaseError(res, databaseError, "create student");
}

// Handle not found errors
if (!student) {
  return ErrorResponses.notFound(res, "Student", studentId);
}
```

### **Custom Error Handling**

```javascript
import { EnhancedErrorHandler } from "../utils/errorHandler.js";

try {
  // Your code here
} catch (error) {
  const errorInfo = EnhancedErrorHandler.handleUnexpectedError(
    error,
    "create student"
  );
  return EnhancedErrorHandler.sendErrorResponse(res, errorInfo);
}
```

## Benefits

### **For Developers:**

- Clear error messages for debugging
- Specific field identification
- Database error code mapping
- Consistent error response format

### **For Users:**

- Understandable error messages
- Actionable suggestions
- Clear indication of what went wrong
- Helpful guidance on how to fix issues

### **For UI Integration:**

- Field-specific error highlighting
- Consistent error display
- User-friendly messaging
- Actionable feedback

## Migration Guide

### **Old Error Handling:**

```javascript
catch (error) {
    logger.error('Error:', error);
    res.status(500).json({
        status: 'error',
        message: 'Internal Server Error'
    });
}
```

### **New Error Handling:**

```javascript
catch (error) {
    return ErrorResponses.unexpectedError(res, error, 'create student');
}
```

This improved error handling system makes the API much more user-friendly and easier to debug!
