# Announcements API Filters Guide

## Overview

This guide provides a comprehensive list of all available filters for the Announcements API endpoints. Filters can be combined to create precise queries for different use cases.

## Available Endpoints

### 1. **General Announcements** (All Users)

```http
GET /api/announcements
```

### 2. **My Announcements** (Parent/Teacher Only)

```http
GET /api/announcements/my-announcements
```

## Complete Filter List

### **Basic Filters**

| Filter              | Type    | Values                                                        | Description                                          | Example                       |
| ------------------- | ------- | ------------------------------------------------------------- | ---------------------------------------------------- | ----------------------------- |
| `status`            | string  | `draft`, `pending`, `approved`, `rejected`, `all`             | Filter by announcement status                        | `?status=approved`            |
| `announcement_type` | string  | `circular`, `general`, `urgent`, `academic`, `administrative` | Filter by announcement type                          | `?announcement_type=circular` |
| `priority`          | string  | `low`, `normal`, `high`, `urgent`                             | Filter by priority level                             | `?priority=high`              |
| `is_featured`       | boolean | `true`, `false`                                               | Filter featured announcements                        | `?is_featured=true`           |
| `unread_only`       | boolean | `true`, `false`                                               | Show only unread announcements (Parent/Teacher only) | `?unread_only=true`           |

### **User Filters**

| Filter        | Type | Values  | Description                             | Example             |
| ------------- | ---- | ------- | --------------------------------------- | ------------------- |
| `created_by`  | UUID | User ID | Filter by announcement creator          | `?created_by=uuid`  |
| `approved_by` | UUID | User ID | Filter by who approved the announcement | `?approved_by=uuid` |

### **Date Range Filters**

| Filter             | Type     | Format                 | Description                                               | Example                                  |
| ------------------ | -------- | ---------------------- | --------------------------------------------------------- | ---------------------------------------- |
| `start_date`       | ISO 8601 | `YYYY-MM-DDTHH:mm:ssZ` | Filter announcements created on or after this date        | `?start_date=2024-01-01T00:00:00Z`       |
| `end_date`         | ISO 8601 | `YYYY-MM-DDTHH:mm:ssZ` | Filter announcements created on or before this date       | `?end_date=2024-12-31T23:59:59Z`         |
| `created_after`    | ISO 8601 | `YYYY-MM-DDTHH:mm:ssZ` | Filter announcements created after this date (exclusive)  | `?created_after=2024-01-01T00:00:00Z`    |
| `created_before`   | ISO 8601 | `YYYY-MM-DDTHH:mm:ssZ` | Filter announcements created before this date (exclusive) | `?created_before=2024-12-31T23:59:59Z`   |
| `published_after`  | ISO 8601 | `YYYY-MM-DDTHH:mm:ssZ` | Filter announcements published after this date            | `?published_after=2024-01-01T00:00:00Z`  |
| `published_before` | ISO 8601 | `YYYY-MM-DDTHH:mm:ssZ` | Filter announcements published before this date           | `?published_before=2024-12-31T23:59:59Z` |

### **Pagination Filters**

| Filter  | Type    | Values     | Description                  | Example     |
| ------- | ------- | ---------- | ---------------------------- | ----------- |
| `page`  | integer | 1, 2, 3... | Page number (default: 1)     | `?page=2`   |
| `limit` | integer | 1-100      | Items per page (default: 20) | `?limit=50` |

## Filter Usage by Role

### **Principal/Admin Filters**

- ✅ All basic filters
- ✅ All user filters
- ✅ All date range filters
- ✅ All pagination filters
- ✅ Status filter with `all` option

### **Teacher/Parent Filters**

- ✅ All basic filters (except status)
- ✅ All date range filters
- ✅ All pagination filters
- ✅ `unread_only` filter (unique to my-announcements)
- ❌ User filters (created_by, approved_by)
- ❌ Status filter (only shows approved announcements)

## Common Filter Combinations

### **1. Recent High Priority Announcements**

```bash
GET /api/announcements?priority=high&created_after=2024-01-01T00:00:00Z&limit=10
```

### **2. Featured Circular Announcements**

```bash
GET /api/announcements?announcement_type=circular&is_featured=true
```

### **3. My Unread Urgent Announcements**

```bash
GET /api/announcements/my-announcements?priority=urgent&unread_only=true
```

### **4. Announcements from Last Week**

```bash
GET /api/announcements?start_date=2024-01-15T00:00:00Z&end_date=2024-01-22T23:59:59Z
```

### **5. Announcements Created by Specific User**

```bash
GET /api/announcements?created_by=uuid&status=approved
```

### **6. Published Announcements in Date Range**

```bash
GET /api/announcements?published_after=2024-01-01T00:00:00Z&published_before=2024-01-31T23:59:59Z
```

### **7. My Announcements from This Month**

```bash
GET /api/announcements/my-announcements?start_date=2024-01-01T00:00:00Z&end_date=2024-01-31T23:59:59Z
```

## Date Format Examples

### **ISO 8601 Format**

```bash
# Full datetime
?start_date=2024-01-15T10:30:00Z

# Date only (start of day)
?start_date=2024-01-15T00:00:00Z

# End of day
?end_date=2024-01-15T23:59:59Z

# Relative dates
?created_after=2024-01-01T00:00:00Z  # After January 1st
?created_before=2024-12-31T23:59:59Z # Before December 31st
```

### **Common Date Patterns**

```bash
# Today's announcements
?start_date=2024-01-15T00:00:00Z&end_date=2024-01-15T23:59:59Z

# This week's announcements
?start_date=2024-01-15T00:00:00Z&end_date=2024-01-21T23:59:59Z

# This month's announcements
?start_date=2024-01-01T00:00:00Z&end_date=2024-01-31T23:59:59Z

# Last 7 days
?created_after=2024-01-08T00:00:00Z

# Last 30 days
?created_after=2024-12-16T00:00:00Z
```

## Advanced Filter Examples

### **Principal Dashboard Filters**

```bash
# Pending approvals
GET /api/announcements?status=pending&page=1&limit=20

# Recent approved announcements
GET /api/announcements?status=approved&created_after=2024-01-01T00:00:00Z

# High priority announcements by specific teacher
GET /api/announcements?priority=high&created_by=teacher-uuid&status=approved

# Featured announcements from last month
GET /api/announcements?is_featured=true&start_date=2023-12-01T00:00:00Z&end_date=2023-12-31T23:59:59Z
```

### **Teacher Filters**

```bash
# My unread announcements
GET /api/announcements/my-announcements?unread_only=true

# High priority circular announcements
GET /api/announcements/my-announcements?announcement_type=circular&priority=high

# Recent announcements (last 7 days)
GET /api/announcements/my-announcements?created_after=2024-01-08T00:00:00Z

# Featured announcements
GET /api/announcements/my-announcements?is_featured=true
```

### **Parent Filters**

```bash
# Unread urgent announcements
GET /api/announcements/my-announcements?priority=urgent&unread_only=true

# Circular announcements from this month
GET /api/announcements/my-announcements?announcement_type=circular&start_date=2024-01-01T00:00:00Z&end_date=2024-01-31T23:59:59Z

# All announcements with pagination
GET /api/announcements/my-announcements?page=1&limit=50
```

## Response Format

### **Filter Information in Response**

```json
{
  "status": "success",
  "data": {
    "announcements": [...],
    "pagination": {...},
    "filters": {
      "status": "approved",
      "announcement_type": "circular",
      "priority": "high",
      "is_featured": true,
      "unread_only": false,
      "start_date": "2024-01-01T00:00:00Z",
      "end_date": "2024-01-31T23:59:59Z",
      "page": 1,
      "limit": 20
    }
  }
}
```

## Best Practices

### **1. Use Appropriate Date Formats**

- Always use ISO 8601 format for dates
- Include timezone information (Z for UTC)
- Use start/end of day for date-only queries

### **2. Combine Filters Efficiently**

- Use specific filters to reduce result set
- Combine date ranges with other filters
- Use pagination for large result sets

### **3. Role-Specific Filtering**

- Principals/Admins: Use status filters for approval workflow
- Teachers/Parents: Use unread_only for personal dashboard
- All users: Use date ranges for time-based queries

### **4. Performance Considerations**

- Limit result sets with pagination
- Use specific date ranges instead of broad queries
- Combine multiple filters to narrow results

## Error Handling

### **Invalid Filter Values**

```json
{
  "status": "error",
  "message": "Validation failed",
  "errors": [
    {
      "field": "announcement_type",
      "message": "Invalid announcement type"
    }
  ]
}
```

### **Invalid Date Format**

```json
{
  "status": "error",
  "message": "Invalid date format. Use ISO 8601 format (YYYY-MM-DDTHH:mm:ssZ)"
}
```

## Testing Filters

### **Test Script**

```bash
# Test basic filters
curl "http://localhost:3000/api/announcements?announcement_type=circular&priority=high"

# Test date filters
curl "http://localhost:3000/api/announcements?start_date=2024-01-01T00:00:00Z&end_date=2024-01-31T23:59:59Z"

# Test parent/teacher filters
curl "http://localhost:3000/api/announcements/my-announcements?unread_only=true"
```

### **Filter Testing Examples**

```javascript
// Test multiple filters
const response = await fetch(
  "/api/announcements?announcement_type=circular&priority=high&is_featured=true&start_date=2024-01-01T00:00:00Z"
);

// Test parent/teacher filters
const response = await fetch(
  "/api/announcements/my-announcements?unread_only=true&priority=urgent"
);
```

This comprehensive filter guide covers all available options for querying announcements based on your specific needs and user role!
