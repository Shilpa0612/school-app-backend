# Attendance System Error Handling Guide

## 🚨 **Enhanced Error Responses**

The attendance system now provides detailed error responses to help with debugging and troubleshooting. All endpoints now return comprehensive error information instead of generic "Internal server error" messages.

## 📋 **Error Response Structure**

### **Standard Error Response Format**

```json
{
  "status": "error",
  "message": "Human-readable error message",
  "error_details": {
    "message": "Technical error message",
    "name": "Error type name",
    "code": "Specific error code",
    "hint": "Helpful hint for resolution",
    "stack": "Stack trace (development only)"
  },
  "debug_info": {
    "user_id": "User making the request",
    "user_role": "User's role",
    "timestamp": "When error occurred",
    "endpoint": "API endpoint called",
    "additional_context": "Request-specific information"
  }
}
```

## 🔧 **Available Endpoints**

### **1. GET `/api/attendance/daily` - Daily Overview**

- **Purpose**: Get daily attendance overview for dashboard
- **Access**: Teachers, Admins, Principals
- **Query Parameters**:
  - `date` (optional): Specific date
  - `class_division_id` (optional): Specific class

### **2. POST `/api/attendance/daily` - Mark Attendance**

- **Purpose**: Mark daily attendance for a class
- **Access**: Teachers, Admins, Principals
- **Body**:
  - `class_division_id`: Class ID
  - `attendance_date`: Date
  - `present_students`: Array of student IDs

### **3. GET `/api/attendance/daily/class/:class_division_id` - Class Attendance**

- **Purpose**: Get attendance for specific class and date
- **Access**: Teachers (assigned), Admins, Principals
- **Query Parameters**: `date` (required)

## 🚫 **Common Error Scenarios & Solutions**

### **1. Missing Required Parameters**

#### **Error Response:**

```json
{
  "status": "error",
  "message": "Date parameter is required",
  "required_params": ["date"],
  "received_params": {},
  "endpoint": "/api/attendance/daily/class/:class_division_id"
}
```

#### **Solution:**

- Ensure all required parameters are provided
- Check parameter names and values
- Verify request format

### **2. Permission Denied**

#### **Error Response:**

```json
{
  "status": "error",
  "message": "You can only view attendance for your assigned classes",
  "requested_class_id": "class-uuid",
  "user_id": "user-uuid",
  "user_role": "teacher",
  "required_permission": "teacher_assigned_to_class"
}
```

#### **Solution:**

- Verify user has correct role
- Check if teacher is assigned to the requested class
- Ensure proper authentication

### **3. Database Connection Issues**

#### **Error Response:**

```json
{
  "status": "error",
  "message": "Database error occurred while fetching attendance",
  "error_details": {
    "message": "Connection timeout",
    "code": "PGRST301",
    "hint": "Database connection issue. Please try again."
  },
  "debug_info": {
    "class_division_id": "class-uuid",
    "date": "2024-01-15",
    "user_id": "user-uuid",
    "query_executed": true
  }
}
```

#### **Solution:**

- Check database connectivity
- Verify database credentials
- Check for network issues
- Retry the request

### **4. No Data Found**

#### **Error Response:**

```json
{
  "status": "error",
  "message": "No attendance marked for this date",
  "debug_info": {
    "class_division_id": "class-uuid",
    "date": "2024-01-15",
    "academic_year_id": "year-uuid",
    "query_executed": true
  }
}
```

#### **Solution:**

- Verify the date is correct
- Check if attendance has been marked for that date
- Ensure class exists and is active

### **5. Validation Errors**

#### **Error Response:**

```json
{
  "status": "error",
  "message": "present_students must be an array",
  "received_type": "string",
  "expected_type": "array",
  "received_value": "student-id",
  "endpoint": "/api/attendance/daily"
}
```

#### **Solution:**

- Check data types in request body
- Ensure arrays are properly formatted
- Validate request structure

## 🔍 **Debugging Information**

### **What's Included in Debug Info:**

1. **User Context**
   - User ID and role
   - Authentication status
   - Request timestamp

2. **Request Details**
   - Endpoint called
   - Query parameters
   - Request body
   - Path parameters

3. **Database Context**
   - Query execution status
   - Academic year information
   - Class division details

4. **Error Context**
   - Error codes and messages
   - Database error details
   - Stack traces (development)

## 📊 **Error Codes Reference**

### **Database Error Codes:**

- **PGRST301**: Connection timeout/connection issue
- **PGRST116**: No data found
- **PGRST301**: Database timeout
- **UNKNOWN_ERROR**: Generic database error

### **Application Error Codes:**

- **TYPE_ERROR**: Data type mismatch
- **VALIDATION_ERROR**: Invalid data format
- **PERMISSION_ERROR**: Access denied
- **NOT_FOUND**: Resource not found

## 🛠 **Troubleshooting Steps**

### **1. Check Request Format**

```bash
# Verify endpoint exists
GET /api/attendance/daily

# Check required parameters
GET /api/attendance/daily/class/{class-id}?date=2024-01-15

# Validate request body
POST /api/attendance/daily
{
  "class_division_id": "uuid",
  "attendance_date": "2024-01-15",
  "present_students": ["student-id-1", "student-id-2"]
}
```

### **2. Verify Permissions**

- Check user role in authentication token
- Verify teacher-class assignments
- Ensure proper access levels

### **3. Check Database State**

- Verify academic year is active
- Check if class exists and is active
- Ensure attendance records exist

### **4. Review Logs**

- Check server logs for detailed error information
- Look for database connection issues
- Verify authentication status

## 📱 **Frontend Error Handling**

### **Example Error Handling:**

```javascript
const fetchDailyAttendance = async () => {
  try {
    const response = await fetch("/api/attendance/daily");
    const data = await response.json();

    if (data.status === "error") {
      // Handle specific error types
      if (data.error_details?.code === "DATABASE_CONNECTION_ERROR") {
        showMessage("Database connection issue. Please try again.");
      } else if (data.error_details?.code === "PERMISSION_ERROR") {
        showMessage("Access denied. Please check your permissions.");
      } else {
        showMessage(`Error: ${data.message}`);
      }

      // Log detailed error for debugging
      console.error("Attendance Error:", data);
    } else {
      // Handle success
      updateAttendanceData(data.data);
    }
  } catch (error) {
    console.error("Network Error:", error);
    showMessage("Network error. Please check your connection.");
  }
};
```

### **Error Display:**

```javascript
const showErrorMessage = (errorData) => {
  const message = `
    ${errorData.message}
    
    ${errorData.error_details?.hint ? `Hint: ${errorData.error_details.hint}` : ""}
    
    ${errorData.debug_info?.endpoint ? `Endpoint: ${errorData.debug_info.endpoint}` : ""}
    
    ${errorData.debug_info?.timestamp ? `Time: ${errorData.debug_info.timestamp}` : ""}
  `;

  alert(message);
};
```

## 🚀 **Best Practices**

### **1. Always Check Error Status**

```javascript
if (response.status === "error") {
  // Handle error appropriately
  handleError(response);
}
```

### **2. Use Error Codes for Specific Handling**

```javascript
switch (errorData.error_details?.code) {
  case "DATABASE_CONNECTION_ERROR":
    retryRequest();
    break;
  case "PERMISSION_ERROR":
    redirectToLogin();
    break;
  default:
    showGenericError();
}
```

### **3. Log Debug Information**

```javascript
console.error("Error Details:", {
  message: errorData.message,
  code: errorData.error_details?.code,
  debug: errorData.debug_info,
});
```

### **4. Provide User-Friendly Messages**

```javascript
const getUserFriendlyMessage = (errorData) => {
  const messages = {
    DATABASE_CONNECTION_ERROR:
      "Service temporarily unavailable. Please try again.",
    PERMISSION_ERROR: "You don't have permission to perform this action.",
    VALIDATION_ERROR: "Please check your input and try again.",
    NOT_FOUND: "The requested information was not found.",
  };

  return messages[errorData.error_details?.code] || errorData.message;
};
```

## 📞 **Support Information**

When reporting errors, include:

1. **Error Response**: Complete error JSON
2. **Request Details**: Endpoint, parameters, body
3. **User Context**: Role, permissions
4. **Timestamp**: When error occurred
5. **Steps to Reproduce**: How to trigger the error

This enhanced error handling will make debugging much easier and provide better user experience! 🎉
