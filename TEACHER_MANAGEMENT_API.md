# Teacher Management API Documentation

## Overview

The Teacher Management API provides comprehensive functionality for managing teachers, including subject assignments, filtering, and search capabilities. This system supports multiple subjects per teacher and intelligent subject-based filtering.

## 🔐 **Authentication & Authorization**

All endpoints require authentication with appropriate role-based access:

- **Admin/Principal**: Full access to all endpoints
- **Teacher**: Limited access (view own assignments, search teachers)
- **Parent**: Limited access (view class teachers)

## 📍 **Base URL**

```
http://localhost:3000/api/academic
```

---

## 🧑‍🏫 **Teacher Endpoints**

### **1. Get All Teachers (with Subject Filtering)**

```http
GET /api/academic/teachers
```

**Access**: Admin, Principal, Teacher

**Query Parameters**:

- `subject` (optional): Filter by subject name (supports partial matching)
- `search` (optional): General search across all teacher fields

**Examples**:

```http
# Find math teachers
GET /api/academic/teachers?subject=math

# Find science teachers named John
GET /api/academic/teachers?subject=science&search=john

# General teacher search
GET /api/academic/teachers?search=senior
```

**Response**:

```json
{
  "status": "success",
  "data": {
    "teachers": [
      {
        "teacher_id": "uuid",
        "user_id": "uuid",
        "staff_id": "uuid",
        "full_name": "Teacher Name",
        "phone_number": "+1234567890",
        "email": "teacher@school.com",
        "department": "Mathematics",
        "designation": "Senior Teacher",
        "is_active": true,
        "subjects_taught": ["Mathematics", "Physics"]
      }
    ],
    "total": 1,
    "message": "Use teacher_id for class division assignments",
    "filters_applied": {
      "subject": "math",
      "search": null
    }
  }
}
```

**Features**:

- ✅ **Smart Subject Matching**: "math" finds "Mathematics", "Maths"
- ✅ **Common Abbreviations**: "sci" → "Science", "eng" → "English"
- ✅ **Case-Insensitive**: Works regardless of capitalization
- ✅ **Combined Filtering**: Subject + search filters work together
- ✅ **Performance Optimized**: Efficient database queries

---

### **2. Assign Subjects to Teacher**

```http
POST /api/academic/teachers/:teacher_id/subjects
```

**Access**: Admin, Principal only

**Request Body**:

```json
{
  "subjects": ["Mathematics", "Physics", "Chemistry"],
  "mode": "replace" // or "append"
}
```

**Parameters**:

- `subjects`: Array of subject names to assign
- `mode`:
  - `"replace"`: Replaces all existing subject assignments
  - `"append"`: Adds to existing subject assignments

**Response**:

```json
{
  "status": "success",
  "data": {
    "teacher_id": "uuid",
    "teacher_name": "John Doe",
    "assigned_subjects": ["Mathematics", "Physics", "Chemistry"],
    "total_subjects": 3,
    "mode": "replace",
    "message": "Subjects assigned successfully"
  }
}
```

**Features**:

- ✅ **Multiple Subjects**: Assign multiple subjects to one teacher
- ✅ **Flexible Modes**: Replace or append to existing assignments
- ✅ **Subject Validation**: Ensures subjects exist in the system
- ✅ **Duplicate Prevention**: No duplicate subject assignments
- ✅ **Audit Trail**: Tracks who assigned subjects and when

---

### **3. Get Teacher's Subject Assignments**

```http
GET /api/academic/teachers/:teacher_id/subjects
```

**Access**: Admin, Principal, Teacher (own subjects only)

**Response**:

```json
{
  "status": "success",
  "data": {
    "teacher_id": "uuid",
    "teacher_name": "John Doe",
    "subjects": [
      {
        "subject_name": "Mathematics",
        "assigned_date": "2024-01-15T10:00:00Z",
        "assigned_by": "admin-uuid",
        "is_active": true
      }
    ],
    "total_subjects": 1
  }
}
```

---

### **4. Remove Subject from Teacher**

```http
DELETE /api/academic/teachers/:teacher_id/subjects/:subject_name
```

**Access**: Admin, Principal only

**Response**:

```json
{
  "status": "success",
  "data": {
    "teacher_id": "uuid",
    "teacher_name": "John Doe",
    "removed_subject": "Chemistry",
    "remaining_subjects": ["Mathematics", "Physics"],
    "message": "Subject removed successfully"
  }
}
```

---

### **5. Get Teachers by Subject**

```http
GET /api/academic/subjects/:subject_name/teachers
```

**Access**: Admin, Principal, Teacher

**Response**:

```json
{
  "status": "success",
  "data": {
    "subject_name": "Mathematics",
    "teachers": [
      {
        "teacher_id": "uuid",
        "full_name": "John Doe",
        "department": "Mathematics",
        "designation": "Senior Teacher",
        "assigned_date": "2024-01-15T10:00:00Z"
      }
    ],
    "total_teachers": 1
  }
}
```

---

## 🎯 **Subject Matching Logic**

### **Smart Abbreviation Recognition**

| Search Term | Matches                |
| ----------- | ---------------------- |
| `math`      | Mathematics, Maths     |
| `sci`       | Science                |
| `eng`       | English                |
| `hindi`     | Hindi                  |
| `kan`       | Kannada                |
| `soc`       | Social Studies, Social |
| `hist`      | History                |
| `geo`       | Geography              |
| `phy`       | Physics                |
| `chem`      | Chemistry              |
| `bio`       | Biology                |

### **Matching Strategies**

1. **Exact Match**: `subject=Mathematics` → Finds "Mathematics"
2. **Partial Match**: `subject=math` → Finds "Mathematics", "Maths"
3. **Abbreviation**: `subject=sci` → Finds "Science"
4. **Reverse Match**: `subject=Mathematics` → Also matches "math"

---

## 🔧 **Database Schema**

### **Using Existing Staff Table**

The system uses the existing `staff` table with a `subject` field that stores an array of subjects:

```sql
-- Existing staff table structure
-- The 'subject' field stores an array of subject names
-- Example: subject = ["Mathematics", "Physics", "Chemistry"]

-- No additional tables needed - uses existing structure
-- subject field type: text[] (array of text)
```

**Benefits of this approach:**

- ✅ **No new tables** - uses existing staff structure
- ✅ **Simple data model** - subjects stored as array
- ✅ **Easy to query** - PostgreSQL array operations
- ✅ **Efficient updates** - single field update
- ✅ **Backward compatible** - existing staff records work

### **Subject Field Format**

```json
{
  "subject": ["Mathematics", "Physics", "Chemistry"]
}
```

**Array Operations Supported:**

- `@>` (contains) - Check if array contains value
- `&&` (overlap) - Check if arrays have common elements
- `[]` (access) - Access array elements by index
- `array_length()` - Get array length
- `unnest()` - Expand array into rows

---

## 🚀 **Usage Examples**

### **Example 1: Assign Multiple Subjects to Teacher**

```bash
curl -X POST http://localhost:3000/api/academic/teachers/teacher-uuid/subjects \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "subjects": ["Mathematics", "Physics"],
    "mode": "replace"
  }'
```

### **Example 2: Find Math Teachers**

```bash
curl "http://localhost:3000/api/academic/teachers?subject=math" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### **Example 3: Combined Search**

```bash
curl "http://localhost:3000/api/academic/teachers?subject=science&search=senior" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 📊 **Response Status Codes**

| Status | Description                          |
| ------ | ------------------------------------ |
| `200`  | Success                              |
| `201`  | Created (subject assigned)           |
| `400`  | Bad Request (validation error)       |
| `401`  | Unauthorized                         |
| `403`  | Forbidden (insufficient permissions) |
| `404`  | Teacher or Subject not found         |
| `409`  | Conflict (duplicate assignment)      |
| `500`  | Internal Server Error                |

---

## 🔍 **Error Handling**

### **Validation Errors**

```json
{
  "status": "error",
  "message": "Validation failed",
  "errors": [
    {
      "field": "subjects",
      "message": "At least one subject is required"
    }
  ]
}
```

### **Duplicate Assignment Error**

```json
{
  "status": "error",
  "message": "Subject already assigned to teacher",
  "data": {
    "teacher_id": "uuid",
    "subject": "Mathematics"
  }
}
```

---

## 🎉 **Benefits**

1. **Flexible Subject Management**: Multiple subjects per teacher
2. **Intelligent Search**: Smart subject matching and abbreviations
3. **Efficient Filtering**: Fast teacher discovery by subject
4. **Audit Trail**: Track subject assignment changes
5. **Role-Based Access**: Secure access control
6. **Performance Optimized**: Efficient database queries
7. **Backward Compatible**: Existing integrations continue to work

---

## 📝 **Notes**

- **Subject assignments** are independent of class assignments
- **Teachers can teach multiple subjects** across different classes
- **Subject filtering** only works for teachers with active subject assignments
- **Performance** is optimized for typical use cases
- **All endpoints** maintain backward compatibility
- **Subject names** are case-sensitive in assignments but case-insensitive in searches

---

## 🔄 **Future Enhancements**

- **Subject Categories**: Group subjects by department/stream
- **Teaching Experience**: Track years of experience per subject
- **Subject Preferences**: Allow teachers to set preferred subjects
- **Bulk Operations**: Assign subjects to multiple teachers at once
- **Subject History**: Track subject assignment changes over time

This comprehensive API provides powerful teacher management capabilities with intelligent subject handling and efficient search functionality.
