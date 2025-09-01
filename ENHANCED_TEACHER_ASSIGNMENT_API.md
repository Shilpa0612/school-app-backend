# Enhanced Teacher Assignment API

## Overview

The teacher assignment PUT endpoint has been enhanced to support **direct teacher replacement**, especially for class teacher assignments. This allows administrators to change which teacher is assigned to a class without creating separate assignments.

## ✅ **Enhanced Endpoint**

```http
PUT /api/academic/class-divisions/:id/teacher-assignment/:assignment_id
```

**Access**: Admin, Principal only

## **New Features**

### **1. Direct Teacher Replacement**

You can now change the teacher assigned to a class by including `teacher_id` in the request body.

### **2. Automatic Class Teacher Replacement**

When assigning a **new teacher as class teacher**, the system automatically:

- Deactivates the existing class teacher assignment
- Assigns the new teacher as class teacher
- Auto-sets the new teacher as primary (if no other primary exists)

### **3. Enhanced Validation**

- Validates new teacher exists and is active
- Prevents duplicate assignments for the same teacher
- Ensures proper class teacher transitions

## **Request Body Options**

```json
{
  "teacher_id": "new-teacher-uuid", // NEW: Change the assigned teacher
  "assignment_type": "class_teacher", // Optional: Change assignment type
  "is_primary": true, // Optional: Change primary status
  "subject": "Mathematics" // Optional: Change subject
}
```

## **Usage Scenarios**

### **1. Replace Class Teacher** ⭐ **(Your requirement)**

**Scenario**: Change the class teacher from Teacher A to Teacher B

```json
PUT /api/academic/class-divisions/91d1cd06-a896-4409-81a5-8fcd2b64e4b0/teacher-assignment/abafa182-0e20-42b7-821f-07b1b46ae439

{
  "teacher_id": "new-teacher-uuid",
  "assignment_type": "class_teacher"
}
```

**What happens**:

1. Existing class teacher assignment is deactivated
2. Current assignment is updated with new teacher
3. New teacher automatically becomes primary (if applicable)
4. Returns success message: `"Class teacher replaced successfully"`

### **2. Change Subject Teacher**

```json
{
  "teacher_id": "different-teacher-uuid",
  "assignment_type": "subject_teacher",
  "subject": "Science"
}
```

### **3. Change Assignment Type Only**

```json
{
  "assignment_type": "subject_teacher",
  "subject": "Mathematics"
}
```

### **4. Change Primary Status Only**

```json
{
  "is_primary": true
}
```

## **Response Format**

### **Success Response**

```json
{
  "status": "success",
  "data": {
    "assignment": {
      "id": "assignment-uuid",
      "class_division_id": "class-uuid",
      "teacher_id": "new-teacher-uuid",
      "assignment_type": "class_teacher",
      "is_primary": true,
      "subject": null,
      "teacher": {
        "id": "new-teacher-uuid",
        "full_name": "New Teacher Name",
        "phone_number": "1234567890",
        "email": "teacher@example.com"
      }
    },
    "changes": {
      "teacher_changed": true,
      "assignment_type_changed": false,
      "primary_status_changed": true,
      "subject_changed": false
    }
  },
  "message": "Class teacher replaced successfully"
}
```

### **Error Responses**

#### **Teacher Not Found**

```json
{
  "status": "error",
  "message": "Invalid teacher ID or teacher not found"
}
```

#### **Teacher Already Assigned**

```json
{
  "status": "error",
  "message": "Teacher is already assigned to this class as subject_teacher",
  "existing_assignment_type": "subject_teacher"
}
```

#### **Assignment Not Found**

```json
{
  "status": "error",
  "message": "Teacher assignment not found"
}
```

#### **Multiple Primary Teachers**

```json
{
  "status": "error",
  "message": "Class already has a primary teacher",
  "existing_primary_teacher_id": "existing-teacher-uuid"
}
```

## **Validation Rules**

### **Teacher ID Validation**

- Must be a valid UUID
- Teacher must exist in the system
- Teacher must have role 'teacher'
- Teacher must be active

### **Assignment Type Validation**

- Must be one of: `class_teacher`, `subject_teacher`, `assistant_teacher`, `substitute_teacher`
- Subject is required for `subject_teacher` assignments

### **Primary Status Validation**

- Only one primary teacher allowed per class
- Class teachers are automatically set as primary (if no other primary exists)

### **Duplicate Prevention**

- Same teacher cannot have multiple assignments to the same class
- Exception: When replacing existing assignment

## **Special Behaviors**

### **Class Teacher Replacement Logic**

When changing `teacher_id` to a new teacher with `assignment_type: "class_teacher"`:

1. **Find existing class teacher** for the class
2. **Deactivate existing assignment** (set `is_active: false`)
3. **Update current assignment** with new teacher
4. **Auto-assign primary status** if no other primary exists
5. **Log the replacement** for audit trail

### **Automatic Primary Assignment**

- New class teachers are automatically set as primary
- Only happens if no other primary teacher exists
- Can be overridden by explicitly setting `is_primary: false`

## **Logging**

The system logs important events:

```javascript
// Class teacher replacement
logger.info("Replaced existing class teacher:", {
  class_division_id,
  old_teacher_id: existingClassTeacher.teacher_id,
  new_teacher_id: teacher_id,
  replaced_assignment_id: existingClassTeacher.id,
});
```

## **Example Flow**

### **Before Enhancement**

To change a class teacher, you had to:

1. Create new teacher assignment
2. Manually deactivate old assignment
3. Handle primary status conflicts
4. Manage duplicate assignments

### **After Enhancement**

Single API call handles everything:

```bash
curl -X PUT \
  'https://ajws-school-ba8ae5e3f955.herokuapp.com/api/academic/class-divisions/91d1cd06-a896-4409-81a5-8fcd2b64e4b0/teacher-assignment/abafa182-0e20-42b7-821f-07b1b46ae439' \
  -H 'Authorization: Bearer your-jwt-token' \
  -H 'Content-Type: application/json' \
  -d '{
    "teacher_id": "new-teacher-uuid",
    "assignment_type": "class_teacher"
  }'
```

**Result**: Class teacher is seamlessly replaced with proper handling of all constraints and relationships.

## **Benefits**

✅ **Simplified Teacher Management**: Single API call for teacher replacement  
✅ **Automatic Constraint Handling**: No manual management of conflicts  
✅ **Data Integrity**: Proper deactivation of old assignments  
✅ **Audit Trail**: Complete logging of changes  
✅ **Flexible Updates**: Support for partial updates  
✅ **Enhanced Validation**: Comprehensive error handling

This enhancement makes teacher assignment management much more intuitive and robust!
