# Statistics API Documentation

## Overview

The Statistics API provides comprehensive dashboard data for different user roles (Parent, Teacher, Principal) in the school management system. Each endpoint returns role-specific statistics including attendance, homework, communication, and academic performance metrics.

## Base URL

```
https://your-domain.com/api/stats
```

## Authentication

All endpoints require authentication. Include the JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

---

## 🎓 Parent Statistics

### Endpoint

```
GET /api/stats/parent
```

### Description

Returns comprehensive statistics for parent dashboard including children's attendance, homework completion, communication activity, and upcoming events.

### Query Parameters

| Parameter   | Type   | Description             | Default                    |
| ----------- | ------ | ----------------------- | -------------------------- |
| `date_from` | string | Start date (YYYY-MM-DD) | First day of current month |
| `date_to`   | string | End date (YYYY-MM-DD)   | Last day of current month  |

### Response Structure

```json
{
  "status": "success",
  "data": {
    "children_count": 2,
    "date_range": {
      "start_date": "2025-01-01",
      "end_date": "2025-01-31"
    },
    "attendance": {
      "student_id_1": {
        "student_name": "John Doe",
        "class_name": "Grade 5 A",
        "total_days": 22,
        "present_days": 20,
        "absent_days": 2,
        "attendance_percentage": 91
      }
    },
    "homework": {
      "student_id_1": {
        "student_name": "John Doe",
        "total_assigned": 15,
        "completed": 12,
        "pending": 3,
        "overdue": 1,
        "completion_rate": 80
      }
    },
    "communication": {
      "total_messages": 25,
      "sent_messages": 8,
      "received_messages": 17,
      "unread_messages": 3
    },
    "upcoming": {
      "events": 5,
      "homework_due_soon": 2
    },
    "summary": {
      "total_children": 2,
      "average_attendance": 89,
      "total_homework": 30,
      "completed_homework": 24
    }
  }
}
```

### Data Fields Explained

#### Attendance Statistics

- **total_days**: Total working days in the date range
- **present_days**: Days student was present
- **absent_days**: Days student was absent
- **attendance_percentage**: Overall attendance percentage

#### Homework Statistics

- **total_assigned**: Total homework assignments
- **completed**: Completed assignments
- **pending**: Pending assignments
- **overdue**: Overdue assignments
- **completion_rate**: Completion percentage

#### Communication Statistics

- **total_messages**: Total messages in date range
- **sent_messages**: Messages sent by parent
- **received_messages**: Messages received by parent
- **unread_messages**: Unread messages

---

## 👨‍🏫 Teacher Statistics

### Endpoint

```
GET /api/stats/teacher
```

### Description

Returns comprehensive statistics for teacher dashboard including class attendance, homework management, student information, and communication activity.

### Query Parameters

| Parameter   | Type   | Description             | Default                    |
| ----------- | ------ | ----------------------- | -------------------------- |
| `date_from` | string | Start date (YYYY-MM-DD) | First day of current month |
| `date_to`   | string | End date (YYYY-MM-DD)   | Last day of current month  |

### Response Structure

```json
{
  "status": "success",
  "data": {
    "assigned_classes": 3,
    "date_range": {
      "start_date": "2025-01-01",
      "end_date": "2025-01-31"
    },
    "attendance": {
      "classes": {
        "class_id_1": {
          "class_name": "Grade 5 A",
          "subject": "Mathematics",
          "total_days": 22,
          "total_students": 30,
          "present_count": 540,
          "absent_count": 120,
          "attendance_percentage": 82
        }
      },
      "summary": {
        "total_students": 90,
        "total_present": 1620,
        "total_absent": 360,
        "overall_percentage": 82
      }
    },
    "homework": {
      "total_assigned": 45,
      "by_subject": {
        "Mathematics": {
          "total": 15,
          "completed": 12,
          "pending": 3,
          "overdue": 1,
          "completion_rate": 80
        }
      },
      "completion_rates": {
        "overall": 78,
        "total": 45,
        "completed": 35
      }
    },
    "communication": {
      "total_messages": 67,
      "sent_messages": 45,
      "received_messages": 22,
      "unread_messages": 5
    },
    "students": {
      "total_students": 90,
      "by_class": {
        "class_id_1": {
          "class_name": "Grade 5 A",
          "student_count": 30,
          "students": [
            {
              "id": "student_id_1",
              "name": "John Doe",
              "admission_number": "2025-001",
              "roll_number": 1
            }
          ]
        }
      }
    },
    "summary": {
      "total_classes": 3,
      "total_students": 90,
      "total_homework": 45,
      "completed_homework": 35,
      "messages_sent": 45
    }
  }
}
```

### Data Fields Explained

#### Attendance Statistics

- **classes**: Attendance data for each assigned class
- **summary**: Overall attendance summary across all classes
- **attendance_percentage**: Class-wise attendance percentage

#### Homework Statistics

- **by_subject**: Homework statistics grouped by subject
- **completion_rates**: Overall completion statistics
- **overdue**: Overdue assignments tracking

#### Student Information

- **by_class**: Student details grouped by class
- **total_students**: Total students across all classes

---

## 🏛️ Principal Statistics

### Endpoint

```
GET /api/stats/principal
```

### Description

Returns school-wide statistics for principal dashboard including overall attendance, homework completion, communication patterns, and calendar events.

### Query Parameters

| Parameter   | Type   | Description             | Default                    |
| ----------- | ------ | ----------------------- | -------------------------- |
| `date_from` | string | Start date (YYYY-MM-DD) | First day of current month |
| `date_to`   | string | End date (YYYY-MM-DD)   | Last day of current month  |

### Response Structure

```json
{
  "status": "success",
  "data": {
    "date_range": {
      "start_date": "2025-01-01",
      "end_date": "2025-01-31"
    },
    "school_overview": {
      "total_students": 450,
      "total_teachers": 25,
      "total_parents": 420,
      "total_classes": 15
    },
    "attendance": {
      "total_days": 22,
      "holiday_days": 3,
      "working_days": 19,
      "classes": {
        "class_id_1": {
          "class_name": "Grade 5 A",
          "total_days": 19,
          "total_students": 30,
          "total_present": 540,
          "total_absent": 120,
          "attendance_percentage": 82
        }
      },
      "overall": {
        "total_students": 450,
        "total_present": 8100,
        "total_absent": 1800,
        "average_percentage": 82
      }
    },
    "homework": {
      "total_assigned": 225,
      "by_subject": {
        "Mathematics": {
          "total": 75,
          "completed": 60,
          "pending": 15,
          "overdue": 5,
          "completion_rate": 80
        }
      },
      "by_teacher": {
        "teacher_id_1": {
          "total_assigned": 45,
          "completed": 35,
          "pending": 10,
          "completion_rate": 78
        }
      },
      "completion_summary": {
        "total": 225,
        "completed": 180,
        "pending": 45,
        "overdue": 15
      }
    },
    "communication": {
      "total_messages": 1250,
      "by_role": {
        "teacher": 450,
        "parent": 750,
        "admin": 30,
        "principal": 20
      },
      "engagement": {
        "sent": 1250,
        "received": 1250,
        "read": 1100,
        "unread": 150
      }
    },
    "calendar": {
      "total_events": 45,
      "by_type": {
        "school_wide": 20,
        "class_specific": 15,
        "multi_class": 10
      },
      "by_category": {
        "general": 15,
        "academic": 10,
        "cultural": 8,
        "sports": 12
      },
      "by_status": {
        "pending": 5,
        "approved": 35,
        "rejected": 5
      }
    },
    "summary": {
      "overall_attendance": 82,
      "homework_completion": 80,
      "total_events": 45,
      "pending_approvals": 5,
      "message_volume": 1250
    }
  }
}
```

### Data Fields Explained

#### School Overview

- **total_students**: Active students count
- **total_teachers**: Active teachers count
- **total_parents**: Active parents count
- **total_classes**: Total class divisions

#### Attendance Statistics

- **total_days**: Total days in date range
- **holiday_days**: Holiday count
- **working_days**: Working days count
- **classes**: Attendance data for each class
- **overall**: School-wide attendance summary

#### Homework Statistics

- **by_subject**: Subject-wise homework statistics
- **by_teacher**: Teacher-wise homework statistics
- **completion_summary**: Overall completion summary

#### Communication Statistics

- **by_role**: Message count by user role
- **engagement**: Read/unread message statistics

#### Calendar Statistics

- **by_type**: Event count by type
- **by_category**: Event count by category
- **by_status**: Event count by approval status

---

## 📊 Common Features

### Date Range Filtering

All endpoints support custom date ranges:

- **Default**: Current month (first to last day)
- **Custom**: Use `date_from` and `date_to` parameters
- **Format**: YYYY-MM-DD

### Error Handling

```json
{
  "status": "error",
  "message": "Error description"
}
```

### Common HTTP Status Codes

- **200**: Success
- **400**: Bad Request
- **401**: Unauthorized
- **403**: Forbidden (wrong role)
- **500**: Internal Server Error

---

## 🔐 Role-Based Access Control

| Endpoint     | Parent | Teacher | Principal | Admin |
| ------------ | ------ | ------- | --------- | ----- |
| `/parent`    | ✅     | ❌      | ❌        | ❌    |
| `/teacher`   | ❌     | ✅      | ❌        | ❌    |
| `/principal` | ❌     | ❌      | ✅        | ✅    |

---

## 📱 Usage Examples

### Frontend Dashboard Integration

```javascript
// Get parent statistics
const getParentStats = async (dateFrom, dateTo) => {
  const response = await fetch(
    `/api/stats/parent?date_from=${dateFrom}&date_to=${dateTo}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response.json();
};

// Get teacher statistics
const getTeacherStats = async (dateFrom, dateTo) => {
  const response = await fetch(
    `/api/stats/teacher?date_from=${dateFrom}&date_to=${dateTo}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response.json();
};

// Get principal statistics
const getPrincipalStats = async (dateFrom, dateTo) => {
  const response = await fetch(
    `/api/stats/principal?date_from=${dateFrom}&date_to=${dateTo}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response.json();
};
```

### Mobile App Integration

```javascript
// React Native example
const fetchStats = async () => {
  try {
    const response = await fetch(`${API_BASE}/stats/parent`, {
      headers: {
        Authorization: `Bearer ${userToken}`,
        "Content-Type": "application/json",
      },
    });

    if (response.ok) {
      const data = await response.json();
      setStats(data.data);
    }
  } catch (error) {
    console.error("Error fetching stats:", error);
  }
};
```

---

## 🚀 Performance Considerations

### Data Optimization

- **Efficient Queries**: Uses optimized database views and functions
- **Minimal API Calls**: Single endpoint returns comprehensive data
- **Smart Filtering**: Date range filtering reduces data transfer

### Caching Recommendations

- **Frontend Caching**: Cache statistics for 5-10 minutes
- **Background Refresh**: Update data in background for real-time feel
- **Progressive Loading**: Load summary data first, then detailed breakdowns

---

## 🔧 Troubleshooting

### Common Issues

#### 1. 403 Forbidden Error

**Cause**: User role doesn't match endpoint requirements
**Solution**: Verify user role in JWT token

#### 2. Empty Data Response

**Cause**: No data in specified date range
**Solution**: Check date parameters and verify data exists

#### 3. Slow Response Times

**Cause**: Large date ranges or complex queries
**Solution**: Use smaller date ranges or implement pagination

### Debug Mode

Enable detailed logging by setting environment variable:

```bash
DEBUG_STATS=true
```

### Debug Endpoint

For troubleshooting teacher assignment issues, use the debug endpoint:

```http
GET /api/stats/debug/teacher-assignments/:teacher_id
```

**Response:**

```json
{
  "status": "success",
  "data": {
    "teacher": {
      "id": "teacher-uuid",
      "full_name": "Teacher Name",
      "role": "teacher",
      "status": "active"
    },
    "new_table_assignments": {
      "data": [],
      "error": null,
      "count": 0
    },
    "old_table_assignments": {
      "data": [],
      "error": null,
      "count": 0
    },
    "direct_class_assignments": {
      "data": [],
      "error": null,
      "count": 0
    },
    "summary": {
      "total_assignments": 0,
      "has_new_table_data": false,
      "has_old_table_data": false,
      "has_direct_assignments": false
    }
  }
}
```

**Note:** This endpoint is for debugging purposes only and should be removed in production.

---

## 📈 Future Enhancements

### Planned Features

- **Real-time Updates**: WebSocket integration for live statistics
- **Export Functionality**: PDF/Excel report generation
- **Advanced Analytics**: Trend analysis and predictions
- **Custom Dashboards**: User-configurable statistics views
- **Performance Metrics**: API response time monitoring

### API Versioning

Future updates will maintain backward compatibility through versioned endpoints:

```
/api/v2/stats/parent
/api/v2/stats/teacher
/api/v2/stats/principal
```
