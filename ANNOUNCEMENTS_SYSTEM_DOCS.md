# Announcements System Documentation

## Overview

The Announcements System provides a comprehensive solution for school-wide communication with approval workflow, targeting, and analytics. It supports multiple announcement types, priority levels, and role-based access control.

## Features

### ✅ **Core Features**

- **Multiple Announcement Types**: Circular, General, Urgent, Academic, Administrative
- **Approval Workflow**: Auto-approval for Principal/Admin, manual approval for others
- **Targeting**: Role-based and class-based targeting
- **Priority Levels**: Low, Normal, High, Urgent
- **Scheduling**: Publish and expiry dates
- **Attachments**: File upload support
- **Analytics**: View tracking and delivery status
- **Pagination**: Efficient data loading

### ✅ **Approval System**

- **Auto-Approval**: Principal/Admin announcements are automatically approved
- **Manual Approval**: Other users require Principal/Admin approval
- **Rejection Support**: Rejection with reason tracking
- **Status Tracking**: Draft → Pending → Approved/Rejected

## Database Schema

### **Tables**

#### 1. `announcements`

Main announcements table with all core data.

| Column               | Type      | Description                                               |
| -------------------- | --------- | --------------------------------------------------------- |
| `id`                 | UUID      | Primary key                                               |
| `title`              | TEXT      | Announcement title (1-200 chars)                          |
| `content`            | TEXT      | Announcement content (1-5000 chars)                       |
| `announcement_type`  | TEXT      | Type: circular, general, urgent, academic, administrative |
| `status`             | TEXT      | Status: draft, pending, approved, rejected                |
| `priority`           | TEXT      | Priority: low, normal, high, urgent                       |
| `created_by`         | UUID      | Creator user ID                                           |
| `approved_by`        | UUID      | Approver user ID (nullable)                               |
| `approved_at`        | TIMESTAMP | Approval timestamp (nullable)                             |
| `rejected_by`        | UUID      | Rejector user ID (nullable)                               |
| `rejected_at`        | TIMESTAMP | Rejection timestamp (nullable)                            |
| `rejection_reason`   | TEXT      | Reason for rejection (nullable)                           |
| `target_roles`       | TEXT[]    | Array of target roles                                     |
| `target_classes`     | TEXT[]    | Array of target class IDs                                 |
| `target_departments` | TEXT[]    | Array of target department IDs                            |
| `publish_at`         | TIMESTAMP | Scheduled publish date (nullable)                         |
| `expires_at`         | TIMESTAMP | Expiry date (nullable)                                    |
| `is_published`       | BOOLEAN   | Whether publicly visible                                  |
| `is_featured`        | BOOLEAN   | Whether featured/pinned                                   |
| `view_count`         | INTEGER   | View count                                                |
| `created_at`         | TIMESTAMP | Creation timestamp                                        |
| `updated_at`         | TIMESTAMP | Last update timestamp                                     |

#### 2. `announcement_attachments`

File attachments for announcements.

| Column            | Type      | Description               |
| ----------------- | --------- | ------------------------- |
| `id`              | UUID      | Primary key               |
| `announcement_id` | UUID      | Reference to announcement |
| `file_name`       | TEXT      | Original filename         |
| `file_path`       | TEXT      | Storage path              |
| `file_size`       | INTEGER   | File size in bytes        |
| `file_type`       | TEXT      | File type                 |
| `mime_type`       | TEXT      | MIME type                 |
| `uploaded_by`     | UUID      | Uploader user ID          |
| `created_at`      | TIMESTAMP | Upload timestamp          |

#### 3. `announcement_views`

Track who viewed which announcements.

| Column            | Type      | Description               |
| ----------------- | --------- | ------------------------- |
| `id`              | UUID      | Primary key               |
| `announcement_id` | UUID      | Reference to announcement |
| `user_id`         | UUID      | Viewer user ID            |
| `viewed_at`       | TIMESTAMP | View timestamp            |

#### 4. `announcement_recipients`

Track delivery and read status.

| Column            | Type      | Description                              |
| ----------------- | --------- | ---------------------------------------- |
| `id`              | UUID      | Primary key                              |
| `announcement_id` | UUID      | Reference to announcement                |
| `user_id`         | UUID      | Recipient user ID                        |
| `delivery_status` | TEXT      | Status: pending, delivered, failed, read |
| `delivered_at`    | TIMESTAMP | Delivery timestamp (nullable)            |
| `read_at`         | TIMESTAMP | Read timestamp (nullable)                |
| `created_at`      | TIMESTAMP | Creation timestamp                       |

## API Endpoints

### **Base URL**: `/api/announcements`

### 1. **Create Announcement**

```http
POST /api/announcements
```

**Request Body:**

```json
{
  "title": "School Holiday Notice",
  "content": "School will be closed on Monday for Republic Day.",
  "announcement_type": "circular",
  "priority": "high",
  "target_roles": ["teacher", "parent", "student"],
  "target_classes": ["class-id-1", "class-id-2"],
  "publish_at": "2024-01-25T00:00:00Z",
  "expires_at": "2024-01-30T23:59:59Z",
  "is_featured": true
}
```

**Response:**

```json
{
  "status": "success",
  "message": "Announcement created and published successfully",
  "data": {
    "announcement": {
      "id": "uuid",
      "title": "School Holiday Notice",
      "content": "School will be closed on Monday for Republic Day.",
      "announcement_type": "circular",
      "status": "approved",
      "priority": "high",
      "created_by": "uuid",
      "approved_by": "uuid",
      "approved_at": "2024-01-24T10:00:00Z",
      "is_published": true,
      "created_at": "2024-01-24T10:00:00Z",
      "updated_at": "2024-01-24T10:00:00Z"
    },
    "auto_approved": true
  }
}
```

### 2. **Get Announcements**

```http
GET /api/announcements?status=approved&announcement_type=circular&page=1&limit=20
```

**Query Parameters:**

- `status`: draft, pending, approved, rejected, all
- `announcement_type`: circular, general, urgent, academic, administrative
- `priority`: low, normal, high, urgent
- `is_featured`: true, false
- `created_by`: User ID
- `approved_by`: User ID
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)

**Response:**

```json
{
  "status": "success",
  "data": {
    "announcements": [
      {
        "id": "uuid",
        "title": "School Holiday Notice",
        "content": "School will be closed on Monday for Republic Day.",
        "announcement_type": "circular",
        "status": "approved",
        "priority": "high",
        "created_by": "uuid",
        "approved_by": "uuid",
        "approved_at": "2024-01-24T10:00:00Z",
        "is_published": true,
        "is_featured": true,
        "view_count": 150,
        "created_at": "2024-01-24T10:00:00Z",
        "updated_at": "2024-01-24T10:00:00Z",
        "creator": {
          "id": "uuid",
          "full_name": "Principal Name",
          "role": "principal"
        },
        "approver": {
          "id": "uuid",
          "full_name": "Principal Name",
          "role": "principal"
        },
        "attachments": []
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "total_pages": 8,
      "has_next": true,
      "has_prev": false
    },
    "filters": {
      "status": "approved",
      "announcement_type": "circular",
      "page": 1,
      "limit": 20
    }
  }
}
```

### 3. **Get Single Announcement**

```http
GET /api/announcements/{id}
```

**Response:**

```json
{
  "status": "success",
  "data": {
    "announcement": {
      "id": "uuid",
      "title": "School Holiday Notice",
      "content": "School will be closed on Monday for Republic Day.",
      "announcement_type": "circular",
      "status": "approved",
      "priority": "high",
      "target_roles": ["teacher", "parent", "student"],
      "target_classes": ["class-id-1"],
      "publish_at": "2024-01-25T00:00:00Z",
      "expires_at": "2024-01-30T23:59:59Z",
      "is_published": true,
      "is_featured": true,
      "view_count": 150,
      "created_at": "2024-01-24T10:00:00Z",
      "updated_at": "2024-01-24T10:00:00Z",
      "creator": {
        "id": "uuid",
        "full_name": "Principal Name",
        "role": "principal"
      },
      "approver": {
        "id": "uuid",
        "full_name": "Principal Name",
        "role": "principal"
      },
      "attachments": [
        {
          "id": "uuid",
          "file_name": "holiday_notice.pdf",
          "file_size": 1024000,
          "file_type": "pdf",
          "mime_type": "application/pdf"
        }
      ]
    }
  }
}
```

### 4. **Update Announcement**

```http
PUT /api/announcements/{id}
```

**Request Body:**

```json
{
  "title": "Updated School Holiday Notice",
  "content": "Updated content...",
  "priority": "urgent",
  "is_featured": true
}
```

### 5. **Approve/Reject Announcement**

```http
PATCH /api/announcements/{id}/approval
```

**Request Body:**

```json
{
  "action": "approve"
}
```

Or for rejection:

```json
{
  "action": "reject",
  "rejection_reason": "Content needs revision"
}
```

### 6. **Get Pending Approvals**

```http
GET /api/announcements/pending/approvals?page=1&limit=20
```

**Response:**

```json
{
  "status": "success",
  "data": {
    "pending_announcements": [
      {
        "id": "uuid",
        "title": "Teacher Meeting Notice",
        "content": "Monthly teacher meeting scheduled...",
        "announcement_type": "general",
        "status": "pending",
        "created_by": "uuid",
        "created_at": "2024-01-24T09:00:00Z",
        "creator": {
          "id": "uuid",
          "full_name": "Teacher Name",
          "role": "teacher"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5,
      "total_pages": 1,
      "has_next": false,
      "has_prev": false
    }
  }
}
```

### 7. **Delete Announcement**

```http
DELETE /api/announcements/{id}
```

## Approval Workflow

### **Auto-Approval**

- **Principal/Admin**: Announcements are automatically approved and published
- **Other Users**: Announcements require manual approval

### **Manual Approval Process**

1. **Create**: User creates announcement (status: pending)
2. **Review**: Principal/Admin reviews pending announcements
3. **Approve/Reject**: Principal/Admin approves or rejects with reason
4. **Publish**: Approved announcements become publicly visible
5. **Recipients**: Recipients are automatically created for approved announcements

### **Status Flow**

```
Draft → Pending → Approved/Rejected
  ↑        ↓           ↓
  └── Edit └── Review └── Published/Rejected
```

## Targeting System

### **Role-Based Targeting**

```json
{
  "target_roles": ["teacher", "parent", "student", "admin"]
}
```

### **Class-Based Targeting**

```json
{
  "target_classes": ["class-division-id-1", "class-division-id-2"]
}
```

### **Department-Based Targeting**

```json
{
  "target_departments": ["department-id-1", "department-id-2"]
}
```

## Priority Levels

| Priority | Description     | Use Case                                           |
| -------- | --------------- | -------------------------------------------------- |
| `low`    | Low priority    | General information, reminders                     |
| `normal` | Normal priority | Regular announcements                              |
| `high`   | High priority   | Important notices, events                          |
| `urgent` | Urgent priority | Emergency announcements, immediate action required |

## Announcement Types

| Type             | Description                  | Use Case                                 |
| ---------------- | ---------------------------- | ---------------------------------------- |
| `circular`       | Official school circulars    | Policies, procedures, official notices   |
| `general`        | General announcements        | Events, activities, general information  |
| `urgent`         | Emergency announcements      | Emergency closures, immediate alerts     |
| `academic`       | Academic announcements       | Exam schedules, academic events          |
| `administrative` | Administrative announcements | Administrative procedures, staff notices |

## Security & Permissions

### **Access Control**

- **View**: Users can view published announcements and their own
- **Create**: All authenticated users can create announcements
- **Edit**: Users can edit their own draft announcements
- **Delete**: Users can delete their own draft announcements
- **Approve/Reject**: Only Principal/Admin can approve/reject

### **Row Level Security (RLS)**

- Users can only see announcements they have permission to view
- Principals/Admins can see all announcements
- Other users can only see published announcements or their own

## Performance Optimizations

### **Database Indexes**

- Status, type, priority indexes for filtering
- Created_by, approved_by indexes for user queries
- Publish_at, expires_at indexes for scheduling
- Composite indexes for common query patterns

### **Pagination**

- Efficient pagination with offset/limit
- Total count for pagination metadata
- Configurable page sizes (max 100)

### **View Tracking**

- Automatic view tracking for published announcements
- Unique views per user per announcement
- Performance-optimized view counting

## Testing

### **Test Script**

```bash
node test_announcements.js
```

### **Test Coverage**

- ✅ Create announcements (all types)
- ✅ Get announcements with filtering
- ✅ Update announcements
- ✅ Approval workflow
- ✅ Pending approvals
- ✅ Delete announcements
- ✅ Error handling
- ✅ Permission validation

## Error Handling

### **Common Error Responses**

#### 400 Bad Request

```json
{
  "status": "error",
  "message": "Validation failed",
  "errors": [
    {
      "field": "title",
      "message": "Title must be between 1 and 200 characters"
    }
  ]
}
```

#### 401 Unauthorized

```json
{
  "status": "error",
  "message": "Unauthorized"
}
```

#### 403 Forbidden

```json
{
  "status": "error",
  "message": "You do not have permission to edit this announcement"
}
```

#### 404 Not Found

```json
{
  "status": "error",
  "message": "Announcement not found"
}
```

#### 500 Internal Server Error

```json
{
  "status": "error",
  "message": "Failed to create announcement"
}
```

## Migration

### **Run Migration**

```bash
# Execute the SQL migration file
psql -d your_database -f migrations/create_announcements_system.sql
```

### **Migration Features**

- ✅ Creates all required tables
- ✅ Sets up indexes for performance
- ✅ Configures RLS policies
- ✅ Creates triggers for auto-approval
- ✅ Sets up recipient creation triggers

## Future Enhancements

### **Planned Features**

1. **Email Notifications**: Send email notifications for new announcements
2. **Push Notifications**: Real-time push notifications
3. **Templates**: Predefined announcement templates
4. **Analytics Dashboard**: Detailed analytics and reporting
5. **Bulk Operations**: Bulk approve/reject functionality
6. **Advanced Targeting**: More granular targeting options
7. **Scheduling**: Advanced scheduling with recurring announcements
8. **Comments**: Allow comments on announcements
9. **Attachments**: Enhanced file upload with preview
10. **Search**: Full-text search functionality

## Support

For questions or issues with the Announcements System:

1. Check the error logs for detailed error messages
2. Verify database permissions and RLS policies
3. Ensure proper authentication and authorization
4. Test with the provided test script
5. Review the API documentation for correct usage
