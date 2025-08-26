# Parent/Teacher Announcements Feature

## Overview

The Parent/Teacher Announcements feature provides a dedicated API endpoint for parents and teachers to view announcements that are specifically targeted to them, with read status tracking and filtering capabilities.

## Features

### ✅ **Core Features**

- **Targeted Announcements**: Only shows announcements targeted to the user's role
- **Read Status Tracking**: Tracks which announcements have been read
- **Advanced Filtering**: Filter by type, priority, featured status, and read status
- **Pagination**: Efficient pagination with configurable page sizes
- **Summary Statistics**: Provides read/unread counts and targeting statistics
- **Auto View Tracking**: Automatically tracks when announcements are viewed

### ✅ **User Experience**

- **Role-Based Access**: Only parents and teachers can access these endpoints
- **Personalized Content**: Shows only relevant announcements
- **Unread Filtering**: Option to show only unread announcements
- **Read Status Management**: Mark announcements as read

## API Endpoints

### **Base URL**: `/api/announcements`

### 1. **Get My Announcements**

```http
GET /api/announcements/my-announcements
```

**Authentication**: Required (Parent/Teacher only)

**Query Parameters:**

- `announcement_type`: Filter by type (circular, general, urgent, academic, administrative)
- `priority`: Filter by priority (low, normal, high, urgent)
- `is_featured`: Filter featured announcements (true, false)
- `unread_only`: Show only unread announcements (true, false)
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)

**Example Request:**

```bash
curl -X GET "http://localhost:3000/api/announcements/my-announcements?announcement_type=circular&priority=high&unread_only=true" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

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
        "is_published": true,
        "is_featured": true,
        "created_at": "2024-01-24T10:00:00Z",
        "updated_at": "2024-01-24T10:00:00Z",
        "is_read": false,
        "read_at": null,
        "delivery_status": "pending",
        "creator": {
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
    "summary": {
      "total_targeted": 150,
      "read_count": 45,
      "unread_count": 105,
      "user_role": "parent"
    },
    "filters": {
      "announcement_type": "circular",
      "priority": "high",
      "is_featured": true,
      "unread_only": true
    }
  }
}
```

### 2. **Mark Announcement as Read**

```http
PATCH /api/announcements/{id}/read
```

**Authentication**: Required (Parent/Teacher only)

**Example Request:**

```bash
curl -X PATCH "http://localhost:3000/api/announcements/uuid/read" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**

```json
{
  "status": "success",
  "message": "Announcement marked as read"
}
```

## Targeting Logic

### **How Targeting Works**

1. **Role-Based Targeting**: Shows announcements where `target_roles` includes the user's role
2. **Universal Announcements**: Shows announcements where `target_roles` is empty (targets everyone)
3. **Approved Only**: Only shows approved and published announcements
4. **Personal Announcements**: Users can always see announcements they created

### **Targeting Examples**

```json
// Announcement for teachers only
{
  "target_roles": ["teacher"]
}

// Announcement for parents only
{
  "target_roles": ["parent"]
}

// Announcement for both teachers and parents
{
  "target_roles": ["teacher", "parent"]
}

// Universal announcement (visible to all)
{
  "target_roles": []
}
```

## Read Status Tracking

### **How Read Status Works**

1. **Automatic View Tracking**: When a user views an announcement, it's automatically tracked
2. **Manual Read Marking**: Users can explicitly mark announcements as read
3. **Delivery Status**: Tracks delivery status (pending, delivered, failed, read)
4. **Read Timestamp**: Records when the announcement was marked as read

### **Read Status Fields**

- `is_read`: Boolean indicating if the announcement has been read
- `read_at`: Timestamp when the announcement was marked as read
- `delivery_status`: Current delivery status (pending, delivered, failed, read)

## Filtering Options

### **Available Filters**

| Filter              | Values                                              | Description                    |
| ------------------- | --------------------------------------------------- | ------------------------------ |
| `announcement_type` | circular, general, urgent, academic, administrative | Filter by announcement type    |
| `priority`          | low, normal, high, urgent                           | Filter by priority level       |
| `is_featured`       | true, false                                         | Filter featured announcements  |
| `unread_only`       | true, false                                         | Show only unread announcements |
| `page`              | 1, 2, 3...                                          | Page number for pagination     |
| `limit`             | 1-100                                               | Items per page (default: 20)   |

### **Filter Examples**

```bash
# Get only circular announcements
GET /api/announcements/my-announcements?announcement_type=circular

# Get high priority announcements
GET /api/announcements/my-announcements?priority=high

# Get only unread announcements
GET /api/announcements/my-announcements?unread_only=true

# Get featured announcements with pagination
GET /api/announcements/my-announcements?is_featured=true&page=1&limit=10

# Combined filters
GET /api/announcements/my-announcements?announcement_type=circular&priority=high&unread_only=true
```

## Summary Statistics

### **What's Included**

- **Total Targeted**: Total number of announcements targeted to the user
- **Read Count**: Number of announcements the user has read
- **Unread Count**: Number of announcements the user hasn't read
- **User Role**: The user's role (parent or teacher)

### **Usage Examples**

```javascript
// Get summary for dashboard
const response = await fetch("/api/announcements/my-announcements");
const data = response.data.data.summary;

console.log(`You have ${data.unread_count} unread announcements`);
console.log(
  `You've read ${data.read_count} out of ${data.total_targeted} announcements`
);
```

## Error Handling

### **Common Error Responses**

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
  "message": "Access denied. Only parents and teachers can access this endpoint."
}
```

#### 404 Not Found

```json
{
  "status": "error",
  "message": "Announcement not found or not accessible"
}
```

## Testing

### **Test Script**

```bash
node test_parent_teacher_announcements.js
```

### **Test Coverage**

- ✅ Get targeted announcements
- ✅ Filter by type, priority, featured status
- ✅ Unread only filtering
- ✅ Pagination
- ✅ Mark as read functionality
- ✅ Error handling
- ✅ Summary statistics

## Usage Examples

### **Frontend Integration**

```javascript
// Get user's announcements
async function getUserAnnouncements(filters = {}) {
  const queryParams = new URLSearchParams(filters);
  const response = await fetch(
    `/api/announcements/my-announcements?${queryParams}`
  );
  return response.json();
}

// Mark announcement as read
async function markAsRead(announcementId) {
  const response = await fetch(`/api/announcements/${announcementId}/read`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.json();
}

// Get unread count for notifications
async function getUnreadCount() {
  const response = await getUserAnnouncements({ unread_only: true });
  return response.data.summary.unread_count;
}
```

### **Mobile App Integration**

```javascript
// React Native example
const [announcements, setAnnouncements] = useState([]);
const [unreadCount, setUnreadCount] = useState(0);

useEffect(() => {
  fetchAnnouncements();
}, []);

const fetchAnnouncements = async () => {
  try {
    const response = await api.get("/announcements/my-announcements");
    setAnnouncements(response.data.data.announcements);
    setUnreadCount(response.data.data.summary.unread_count);
  } catch (error) {
    console.error("Failed to fetch announcements:", error);
  }
};

const markAsRead = async (announcementId) => {
  try {
    await api.patch(`/announcements/${announcementId}/read`);
    // Refresh announcements to update read status
    fetchAnnouncements();
  } catch (error) {
    console.error("Failed to mark as read:", error);
  }
};
```

## Performance Considerations

### **Optimizations**

- **Efficient Queries**: Uses database indexes for fast filtering
- **Pagination**: Limits data transfer with pagination
- **Selective Fields**: Only fetches necessary data
- **Caching**: View tracking is optimized for performance

### **Database Indexes**

- `idx_announcements_status_published`: For approved/published filtering
- `idx_announcement_recipients_user_id`: For user-specific queries
- `idx_announcement_views_user_id`: For view tracking

## Security

### **Access Control**

- **Role-Based**: Only parents and teachers can access
- **Authentication**: Requires valid JWT token
- **Authorization**: Validates user permissions
- **Data Isolation**: Users only see their targeted announcements

### **Data Privacy**

- **Personal Data**: Only shows announcements relevant to the user
- **Read Tracking**: Tracks read status for personal use only
- **No Cross-User Access**: Users cannot see other users' read status

## Future Enhancements

### **Planned Features**

1. **Push Notifications**: Real-time notifications for new announcements
2. **Email Notifications**: Email alerts for important announcements
3. **Read Receipts**: Detailed read tracking with timestamps
4. **Announcement Categories**: More granular categorization
5. **Search Functionality**: Full-text search within announcements
6. **Offline Support**: Cache announcements for offline viewing
7. **Bulk Actions**: Mark multiple announcements as read
8. **Announcement Preferences**: User preferences for notification types

## Support

For questions or issues with the Parent/Teacher Announcements feature:

1. Check the API documentation for correct usage
2. Verify authentication and authorization
3. Test with the provided test script
4. Review error logs for detailed error messages
5. Ensure proper targeting configuration in announcements
