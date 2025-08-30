# Announcements Pending Actions - Edit & Delete Functionality

## Overview

The announcements system now includes enhanced functionality that allows users to edit and delete announcements, but **only when they are in "pending" status**. This ensures that once an announcement is approved or rejected, it cannot be modified by the creator.

## Key Changes Made

### 1. **Edit Permissions Updated**

- **Before**: Users could only edit announcements with "draft" status
- **After**: Users can now edit announcements with "pending" status
- **Rationale**: Allows creators to make corrections while waiting for approval
- **Important**: Edited announcements automatically reset to "pending" status for re-approval

### 2. **Delete Permissions Updated**

- **Before**: Users could only delete announcements with "draft" status
- **After**: Users can now delete announcements with "pending" status
- **Rationale**: Allows creators to withdraw announcements before approval

### 3. **New Endpoints Added**

- **GET `/api/announcements/my-pending`** - Get your own pending announcements
- **POST `/api/announcements/bulk-actions`** - Bulk delete/resubmit pending announcements

## API Endpoints

### **Edit Announcement**

```http
PUT /api/announcements/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Updated Title",
  "content": "Updated content",
  "announcement_type": "general",
  "priority": "high"
}
```

**Permissions**:

- ✅ **Admin/Principal**: Can edit any pending announcement
- ✅ **Creator**: Can edit their own pending announcements only
- ❌ **Others**: Cannot edit any announcements

**Important**: When a pending announcement is edited, it automatically moves back to "pending" status and requires re-approval.

**Status Reset on Edit**:

- Any changes to a pending announcement reset its approval status
- All approval/rejection fields are cleared
- The announcement goes back to the approval queue
- This ensures all changes are reviewed before publication

**Response on Edit**:

```json
{
  "status": "success",
  "message": "Announcement updated and moved back to pending status for re-approval",
  "data": {
    "announcement": {...},
    "status_changed": true,
    "requires_reapproval": true
  }
}
```

### **Delete Announcement**

```http
DELETE /api/announcements/:id
Authorization: Bearer <token>
```

**Permissions**:

- ✅ **Admin/Principal**: Can delete any pending announcement
- ✅ **Creator**: Can delete their own pending announcements only
- ❌ **Others**: Cannot delete any announcements

### **Get My Pending Announcements**

```http
GET /api/announcements/my-pending?page=1&limit=20
Authorization: Bearer <token>
```

**Response**:

```json
{
  "status": "success",
  "data": {
    "pending_announcements": [...],
    "pagination": {...},
    "message": "These are your pending announcements that you can edit or delete"
  }
}
```

### **Bulk Actions**

```http
POST /api/announcements/bulk-actions
Authorization: Bearer <token>
Content-Type: application/json

{
  "action": "delete", // or "resubmit"
  "announcement_ids": ["uuid1", "uuid2", "uuid3"]
}
```

**Actions**:

- **`delete`**: Permanently remove pending announcements
- **`resubmit`**: Reset rejected announcements back to pending status

## Status Flow

```
Draft → Pending → [Edit/Delete Allowed] → Approved/Rejected → [No Edit/Delete]
  ↓         ↓              ↓                      ↓
Create   Submit for    Edit → Back to        Published/Rejected
         Approval      Pending Status
```

## Use Cases

### **For Teachers/Staff**

1. **Create announcement** → Status: `pending`
2. **Edit announcement** while pending (fix typos, add details) → **Status resets to pending**
3. **Delete announcement** if no longer needed
4. **Resubmit** if rejected (using bulk actions)

### **For Principals/Admins**

1. **View all pending** announcements for approval
2. **Edit any pending** announcement if needed
3. **Delete any pending** announcement if inappropriate
4. **Approve/Reject** announcements

### **For Parents**

1. **View approved** announcements only
2. **Cannot edit/delete** any announcements
3. **Mark as read** when viewed

## Security Features

### **Permission Checks**

- ✅ **Role-based access**: Admin/Principal have full access
- ✅ **Ownership checks**: Users can only modify their own pending announcements
- ✅ **Status validation**: Only pending announcements can be modified

### **Validation**

- ✅ **Input validation**: All fields validated before processing
- ✅ **UUID validation**: Announcement IDs must be valid UUIDs
- ✅ **Status verification**: Ensures announcements are actually pending

### **Error Handling**

- ✅ **404 errors**: For non-existent announcements
- ✅ **403 errors**: For unauthorized access attempts
- ✅ **400 errors**: For invalid input data
- ✅ **500 errors**: For server/database issues

## Testing

Use the provided test script to verify functionality:

```bash
node test_announcements_pending_actions.js
```

## Migration Notes

### **Existing Announcements**

- **Draft announcements**: Will remain in draft status
- **Pending announcements**: Can now be edited/deleted by creators
- **Approved announcements**: Cannot be modified (unchanged)
- **Rejected announcements**: Cannot be modified (unchanged)

### **Database Changes**

- No new tables or columns required
- Existing announcements table structure unchanged
- All functionality uses existing status field

## Best Practices

### **For Users**

1. **Review carefully** before submitting for approval
2. **Use edit feature** to fix minor issues while pending
3. **Use delete feature** to withdraw inappropriate announcements
4. **Resubmit rejected** announcements after making corrections

### **For Administrators**

1. **Review pending** announcements promptly
2. **Provide clear feedback** when rejecting announcements
3. **Monitor bulk actions** for potential abuse
4. **Use edit feature** to make minor corrections if needed

## Troubleshooting

### **Common Issues**

1. **"Cannot edit announcement" error**
   - Check if announcement status is "pending"
   - Verify you are the creator or have admin/principal role

2. **"Cannot delete announcement" error**
   - Check if announcement status is "pending"
   - Verify you are the creator or have admin/principal role

3. **Bulk actions failing**
   - Ensure all announcement IDs are valid UUIDs
   - Verify all announcements are in "pending" status
   - Check permissions for each announcement

### **Support**

- Check server logs for detailed error messages
- Verify user roles and permissions
- Ensure announcements exist and have correct status
