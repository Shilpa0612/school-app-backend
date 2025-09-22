# Notification Approval Workflow

## 🎯 Overview

This document explains how the notification system handles the approval workflow for announcements and events, ensuring parents only receive notifications for approved content.

## 📋 Approval Workflow

### **Announcements**

#### **1. Teacher Creates Announcement**

- **Status**: `pending`
- **Notification**: ❌ **No notification sent to parents**
- **Reason**: Content needs approval before parents see it

#### **2. Principal/Admin Reviews**

- **Action**: Approve or Reject
- **If Approved**:
  - **Status**: `approved`
  - **Notification**: ✅ **Notifications sent to parents immediately**
  - **Recipients**: All parents based on target roles

#### **3. Principal/Admin Creates Announcement**

- **Status**: `approved` (auto-approved)
- **Notification**: ✅ **Notifications sent to parents immediately**
- **Reason**: Principal/Admin has authority to approve directly

### **Events**

#### **1. Teacher Creates Event**

- **Status**: `pending` (for class-specific events)
- **Notification**: ❌ **No notification sent to parents**
- **Reason**: Event needs approval before parents see it

#### **2. Principal/Admin Reviews**

- **Action**: Approve or Reject
- **If Approved**:
  - **Status**: `approved`
  - **Notification**: ✅ **Notifications sent to parents immediately**
  - **Recipients**: Parents of students in targeted classes

#### **3. Principal/Admin Creates Event**

- **Status**: `approved` (auto-approved)
- **Notification**: ✅ **Notifications sent to parents immediately**
- **Reason**: Principal/Admin has authority to approve directly

### **Homework & Classwork**

#### **Teacher Creates Assignment**

- **Status**: `active` (no approval needed)
- **Notification**: ✅ **Notifications sent to parents immediately**
- **Reason**: Homework/classwork doesn't require approval

## 🔄 Notification Triggers

### **When Notifications Are Sent**

| Content Type | Created By      | Status     | Notification Sent? |
| ------------ | --------------- | ---------- | ------------------ |
| Announcement | Teacher         | `pending`  | ❌ No              |
| Announcement | Teacher         | `approved` | ✅ Yes             |
| Announcement | Principal/Admin | `approved` | ✅ Yes             |
| Event        | Teacher         | `pending`  | ❌ No              |
| Event        | Teacher         | `approved` | ✅ Yes             |
| Event        | Principal/Admin | `approved` | ✅ Yes             |
| Homework     | Teacher         | `active`   | ✅ Yes             |
| Classwork    | Teacher         | `active`   | ✅ Yes             |

### **When Notifications Are NOT Sent**

- ❌ Pending announcements (waiting for approval)
- ❌ Pending events (waiting for approval)
- ❌ Rejected announcements/events
- ❌ Draft content
- ❌ Deleted content

## 🛠️ Implementation Details

### **Code Flow**

```javascript
// 1. Content Creation
if (userRole === "teacher") {
  status = "pending"; // Needs approval
} else if (["principal", "admin"].includes(userRole)) {
  status = "approved"; // Auto-approved
}

// 2. Create Content
const content = await createContent({ status, ...data });

// 3. Send Notifications (only if approved)
if (status === "approved") {
  await sendNotifications(content);
}
```

### **Approval Endpoint**

```javascript
// When principal/admin approves content
if (action === "approve") {
  updateData.status = "approved";
  updateData.is_published = true;

  // Send notifications after approval
  await sendNotifications(updatedContent);
}
```

## 📱 Parent Experience

### **What Parents See**

1. **Immediate Notifications**: Only for approved content
2. **No Pending Notifications**: Parents don't see content until approved
3. **Real-time Updates**: Instant notifications when content is approved
4. **Complete Information**: All notifications include full content details

### **Notification Content**

```json
{
  "type": "announcement",
  "title": "New Announcement: Parent-Teacher Meeting",
  "message": "There will be a parent-teacher meeting next week...",
  "priority": "normal",
  "data": {
    "announcement_id": "uuid",
    "student_name": "John Doe",
    "student_class": "Grade 5 A"
  }
}
```

## 🔒 Security & Privacy

### **Content Visibility**

- **Pending Content**: Only visible to creators and approvers
- **Approved Content**: Visible to all intended recipients
- **Rejected Content**: Only visible to creators and approvers

### **Notification Privacy**

- Parents only receive notifications for content they're authorized to see
- Notifications include student context for personalization
- No notifications for content that doesn't apply to their children

## 🧪 Testing the Workflow

### **Test Scenarios**

1. **Teacher Creates Pending Announcement**

   ```bash
   # Create as teacher
   POST /api/announcements
   # Expected: No notifications sent
   ```

2. **Principal Approves Announcement**

   ```bash
   # Approve as principal
   PUT /api/announcements/:id/approve
   # Expected: Notifications sent to parents
   ```

3. **Principal Creates Announcement**
   ```bash
   # Create as principal
   POST /api/announcements
   # Expected: Notifications sent immediately
   ```

### **Verification Steps**

1. Check notification count before approval
2. Approve content
3. Check notification count after approval
4. Verify parents received notifications
5. Check notification content and targeting

## 📊 Monitoring & Analytics

### **Metrics to Track**

- **Pending Content**: Count of content waiting for approval
- **Approval Rate**: Percentage of content approved vs rejected
- **Notification Delivery**: Success rate of notification delivery
- **Response Time**: Time from approval to notification delivery

### **Dashboard Views**

- **For Principals**: Pending content requiring approval
- **For Teachers**: Status of their submitted content
- **For Parents**: Real-time notification feed

## 🚨 Troubleshooting

### **Common Issues**

1. **No Notifications After Approval**
   - Check if content is properly approved
   - Verify parent-student mappings exist
   - Check notification service logs

2. **Notifications Sent for Pending Content**
   - Check approval workflow implementation
   - Verify status checks in notification triggers

3. **Missing Parent Notifications**
   - Check target roles and class targeting
   - Verify parent-student relationships
   - Check WebSocket connections

### **Debug Commands**

```bash
# Check content status
GET /api/announcements/:id

# Check parent-student mappings
GET /api/parent-student/mappings

# Check notification logs
GET /api/notifications/stats
```

## ✅ Best Practices

### **For Teachers**

- Submit content early to allow time for approval
- Include clear descriptions and context
- Follow school guidelines for content creation

### **For Principals/Admins**

- Review pending content promptly
- Provide feedback for rejected content
- Monitor notification delivery

### **For Developers**

- Always check content status before sending notifications
- Implement proper error handling for notification failures
- Log notification attempts for debugging

## 🎉 Benefits

1. **Quality Control**: Only approved content reaches parents
2. **Real-time Updates**: Parents get instant notifications when content is approved
3. **Proper Workflow**: Clear separation between creation and approval
4. **Parent Trust**: Parents know all notifications are from approved content
5. **Administrative Control**: Principals maintain oversight of all communications

This approval workflow ensures that parents only receive notifications for content that has been properly reviewed and approved, maintaining the quality and appropriateness of school communications.
