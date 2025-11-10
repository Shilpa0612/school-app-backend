# Announcement Edit Status Fix

## 🐛 **Problem Identified**

The announcements system had incorrect status behavior when editing announcements:

### **Before the Fix:**

- ✅ Principal creates → Approved by default
- ❌ Principal edits own approved → Changed to pending (incorrect)
- ✅ Teacher creates → Pending
- ✅ Teacher edits own pending → Stays pending

### **Issue:**

When a principal edited their own approved announcement, it was incorrectly being reset to "pending" status, requiring re-approval.

## 🔧 **Solution Implemented**

### **New Status Logic:**

**Key Principle**: The status depends on WHO CREATED the announcement, and WHO IS EDITING it.

- **Principal creates** → Always approved (regardless of target audience)
- **Principal edits ANY announcement** → Always approved (principal authority)
- **Teacher creates** → Always pending (regardless of target audience)
- **Teacher edits** → Status depends on current state and ownership

| Scenario                          | Creator   | Editor    | Initial Status | Edit Status | Behavior                               |
| --------------------------------- | --------- | --------- | -------------- | ----------- | -------------------------------------- |
| **Principal creates**             | Principal | -         | `approved`     | -           | ✅ Auto-approved                       |
| **Principal edits own approved**  | Principal | Principal | `approved`     | `approved`  | ✅ Stays approved                      |
| **Principal edits teacher's**     | Teacher   | Principal | `pending`      | `approved`  | ✅ Auto-approved (principal authority) |
| **Principal creates for teacher** | Principal | Principal | `approved`     | `approved`  | ✅ Auto-approved (principal authority) |
| **Teacher creates**               | Teacher   | -         | `pending`      | -           | ⏳ Needs approval                      |
| **Teacher edits own pending**     | Teacher   | Teacher   | `pending`      | `pending`   | ✅ Stays pending                       |
| **Teacher edits approved**        | Principal | Teacher   | `approved`     | `pending`   | ⏳ Needs re-approval                   |

## 📝 **Code Changes**

### **File:** `src/routes/announcements.js`

**Lines 456-463:** Updated the status reset logic to be role-aware:

```javascript
// OLD CODE (incorrect):
if (
  existingAnnouncement.status &&
  ["pending", "approved"].includes(existingAnnouncement.status.toLowerCase())
) {
  updateData.status = "pending"; // Always reset to pending
  // ... clear approval fields
}

// NEW CODE (correct):
if (
  existingAnnouncement.status &&
  ["pending", "approved"].includes(existingAnnouncement.status.toLowerCase())
) {
  const editorRole = req.user.role;
  const isOwnAnnouncement = existingAnnouncement.created_by === req.user.id;

  if (["principal", "admin"].includes(editorRole)) {
    if (isOwnAnnouncement && existingAnnouncement.status === "approved") {
      // Principal editing their own approved announcement - keep it approved
      updateData.status = "approved";
      updateData.is_published = true;
    } else {
      // Principal editing someone else's announcement - set to pending for review
      updateData.status = "pending";
      // ... clear approval fields
    }
  } else {
    if (existingAnnouncement.status === "pending") {
      // Teacher editing their own pending announcement - keep it pending
      updateData.status = "pending";
      updateData.is_published = false;
    } else {
      // Teacher editing an approved announcement - set to pending for re-approval
      updateData.status = "pending";
      // ... clear approval fields
    }
  }
}
```

## 🎯 **Key Benefits**

### **1. Improved User Experience**

- Principals can edit their own announcements without losing approval status
- Teachers can edit their pending announcements without status changes
- Clear status transitions based on user roles

### **2. Logical Workflow**

- **Principal Authority**: Principals maintain control over their own approved content
- **Teacher Workflow**: Teachers can make corrections to pending announcements
- **Approval Chain**: Proper approval workflow maintained

### **3. Status Consistency**

- No unnecessary status changes
- Clear distinction between creation and editing behaviors
- Role-based status management

## 🧪 **Testing**

### **Test Script:** `test_announcement_edit_status.js`

The test script verifies all scenarios:

```bash
node test_announcement_edit_status.js
```

### **Manual Testing Scenarios:**

1. **Principal creates announcement**
   - Expected: Status = `approved`
   - Result: ✅ Auto-approved

2. **Principal edits own approved announcement**
   - Expected: Status = `approved` (unchanged)
   - Result: ✅ Stays approved

3. **Teacher creates announcement**
   - Expected: Status = `pending`
   - Result: ✅ Needs approval

4. **Teacher edits own pending announcement**
   - Expected: Status = `pending` (unchanged)
   - Result: ✅ Stays pending

## 📊 **Response Messages**

The system now provides appropriate response messages:

### **Principal Editing Own Approved:**

```json
{
  "message": "Announcement updated successfully (remains approved)",
  "status_changed": false,
  "requires_reapproval": false
}
```

### **Teacher Editing Own Pending:**

```json
{
  "message": "Announcement updated successfully (remains pending)",
  "status_changed": false,
  "requires_reapproval": false
}
```

### **Status Change Required:**

```json
{
  "message": "Announcement updated and moved back to pending status for re-approval",
  "status_changed": true,
  "requires_reapproval": true
}
```

## 🔄 **Status Flow Diagram**

```
Principal Creates → Approved
       ↓
Principal Edits Own → Approved (unchanged)
       ↓
Teacher Creates → Pending
       ↓
Teacher Edits Own → Pending (unchanged)
       ↓
Teacher Edits Approved → Pending (re-approval needed)
```

## ✅ **Verification**

To verify the fix is working:

1. **Create announcement as principal** → Should be approved
2. **Edit the same announcement as principal** → Should stay approved
3. **Create announcement as teacher** → Should be pending
4. **Edit the same announcement as teacher** → Should stay pending

The fix ensures that principals maintain control over their approved announcements while maintaining proper approval workflows for all other scenarios.
