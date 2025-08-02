# Complete Test File for All Remaining Endpoints

## Database Setup Files Required

You need to paste these SQL files into Supabase SQL Editor in this order:

1. **ACTIVITY_SETUP.sql** - Activity planning system
2. **ALERTS_SETUP.sql** - Alerts system
3. **ANALYTICS_SETUP.sql** - Reports & analytics
4. **CHAT_SETUP.sql** - Chat system
5. **FEEDBACK_SETUP.sql** - Feedback system
6. **LISTS_SETUP.sql** - Lists management (uniforms, books, staff)

**Note:** Messages, Leave Requests, and Calendar tables are already in your main SUPABASE_SETUP_V2.sql file, so you don't need separate setup files for those.

---

## 1. Messages System Tests

### Create Message (Draft)

```bash
curl -X POST http://localhost:3000/api/messages \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Important announcement for all parents",
    "type": "announcement",
    "class_id": "YOUR_CLASS_DIVISION_ID"
  }'
```

### List Messages

```bash
curl -X GET "http://localhost:3000/api/messages?status=pending&class_id=YOUR_CLASS_DIVISION_ID" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Approve Message

```bash
curl -X PUT http://localhost:3000/api/messages/YOUR_MESSAGE_ID/approve \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Reject Message

```bash
curl -X PUT http://localhost:3000/api/messages/YOUR_MESSAGE_ID/reject \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Content needs revision"
  }'
```

---

## 2. Leave Requests System Tests

### Create Leave Request

```bash
curl -X POST http://localhost:3000/api/leave-requests \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "student_id": "YOUR_STUDENT_ID",
    "start_date": "2024-02-15T00:00:00Z",
    "end_date": "2024-02-16T00:00:00Z",
    "reason": "Family vacation"
  }'
```

### List Leave Requests

```bash
curl -X GET "http://localhost:3000/api/leave-requests?status=pending" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Update Leave Request Status

```bash
curl -X PUT http://localhost:3000/api/leave-requests/YOUR_LEAVE_REQUEST_ID/status \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "approved"
  }'
```

---

## 3. Calendar System Tests

### Create Calendar Event

```bash
curl -X POST http://localhost:3000/api/calendar/events \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Parent-Teacher Meeting",
    "description": "Annual parent-teacher meeting for all classes",
    "event_date": "2024-03-15T09:00:00Z"
  }'
```

### List Calendar Events

```bash
curl -X GET "http://localhost:3000/api/calendar/events?start_date=2024-01-01&end_date=2024-12-31" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Delete Calendar Event

```bash
curl -X DELETE http://localhost:3000/api/calendar/events/YOUR_EVENT_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 4. Alerts System Tests

### Create Alert (Draft)

```bash
curl -X POST http://localhost:3000/api/alerts \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "School Holiday Announcement",
    "message": "School will be closed on Republic Day",
    "alert_type": "announcement",
    "recipient_type": "all",
    "class_division_id": "YOUR_CLASS_DIVISION_ID"
  }'
```

### List Alerts

```bash
curl -X GET "http://localhost:3000/api/alerts?status=draft" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Approve Alert

```bash
curl -X PUT http://localhost:3000/api/alerts/YOUR_ALERT_ID/approve \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Reject Alert

```bash
curl -X PUT http://localhost:3000/api/alerts/YOUR_ALERT_ID/reject \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rejection_reason": "Content needs approval from principal"
  }'
```

### Send Alert

```bash
curl -X PUT http://localhost:3000/api/alerts/YOUR_ALERT_ID/send \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 5. Chat System Tests

### List Chat Threads

```bash
curl -X GET "http://localhost:3000/api/chat/threads?thread_type=direct" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Create Chat Thread

```bash
curl -X POST http://localhost:3000/api/chat/threads \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "thread_type": "direct",
    "title": "Chat with Parent",
    "participant_ids": ["PARENT_USER_ID"]
  }'
```

### Get Messages

```bash
curl -X GET "http://localhost:3000/api/chat/messages?thread_id=YOUR_THREAD_ID" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Send Message

```bash
curl -X POST http://localhost:3000/api/chat/messages \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "thread_id": "YOUR_THREAD_ID",
    "content": "Hello, how is the student doing?"
  }'
```

### Update Message

```bash
curl -X PUT http://localhost:3000/api/chat/messages/YOUR_MESSAGE_ID \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Updated message content"
  }'
```

### Delete Message

```bash
curl -X DELETE http://localhost:3000/api/chat/messages/YOUR_MESSAGE_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Add Participants to Thread

```bash
curl -X POST http://localhost:3000/api/chat/threads/YOUR_THREAD_ID/participants \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "participant_ids": ["USER_ID_1", "USER_ID_2"]
  }'
```

---

## 6. Lists Management Tests

### Uniforms

#### List Uniforms

```bash
curl -X GET "http://localhost:3000/api/lists/uniforms?grade=Grade 1&gender=unisex" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Create Uniform

```bash
curl -X POST http://localhost:3000/api/lists/uniforms \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Summer Uniform",
    "description": "Light cotton uniform for summer",
    "grade": "Grade 1",
    "gender": "unisex",
    "season": "summer",
    "price": 500,
    "size_available": ["XS", "S", "M", "L", "XL"]
  }'
```

#### Update Uniform

```bash
curl -X PUT http://localhost:3000/api/lists/uniforms/YOUR_UNIFORM_ID \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Uniform Name",
    "price": 600
  }'
```

#### Delete Uniform

```bash
curl -X DELETE http://localhost:3000/api/lists/uniforms/YOUR_UNIFORM_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Books

#### List Books

```bash
curl -X GET "http://localhost:3000/api/lists/books?subject=Mathematics&grade=Grade 1" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Create Book

```bash
curl -X POST http://localhost:3000/api/lists/books \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Mathematics Textbook",
    "author": "Author Name",
    "publisher": "Publisher Name",
    "subject": "Mathematics",
    "grade": "Grade 1",
    "isbn": "978-1234567890",
    "price": 250,
    "edition": "2024"
  }'
```

#### Update Book

```bash
curl -X PUT http://localhost:3000/api/lists/books/YOUR_BOOK_ID \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated Book Title",
    "price": 300
  }'
```

#### Delete Book

```bash
curl -X DELETE http://localhost:3000/api/lists/books/YOUR_BOOK_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Staff

#### List Staff

```bash
curl -X GET "http://localhost:3000/api/lists/staff?department=Mathematics&role=teacher" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Create Staff Member

```bash
curl -X POST http://localhost:3000/api/lists/staff \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "Staff Name",
    "role": "teacher",
    "department": "Mathematics",
    "subject": "Mathematics",
    "email": "staff@school.com",
    "phone": "1234567890",
    "qualification": "M.Sc. Mathematics",
    "experience_years": 5
  }'
```

#### Update Staff Member

```bash
curl -X PUT http://localhost:3000/api/lists/staff/YOUR_STAFF_ID \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "Updated Staff Name",
    "department": "Science"
  }'
```

#### Delete Staff Member

```bash
curl -X DELETE http://localhost:3000/api/lists/staff/YOUR_STAFF_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 7. Reports & Analytics Tests

### Analytics Summary

```bash
curl -X GET "http://localhost:3000/api/analytics/summary?date_from=2024-01-01&date_to=2024-01-31" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Daily Reports

```bash
curl -X GET "http://localhost:3000/api/analytics/daily?date_from=2024-01-01&date_to=2024-01-31" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Generate Custom Report

```bash
curl -X POST http://localhost:3000/api/analytics/reports \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "report_type": "student_performance",
    "date_from": "2024-01-01",
    "date_to": "2024-01-31",
    "filters": {
      "class_division_id": "YOUR_CLASS_DIVISION_ID",
      "subject": "Mathematics"
    }
  }'
```

### List Reports

```bash
curl -X GET "http://localhost:3000/api/analytics/reports?status=completed" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get Report Details

```bash
curl -X GET http://localhost:3000/api/analytics/reports/YOUR_REPORT_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 8. Activity Planning Tests

### List Activities

```bash
curl -X GET "http://localhost:3000/api/activities?class_division_id=YOUR_CLASS_DIVISION_ID" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Create Activity

```bash
curl -X POST http://localhost:3000/api/activities \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Science Fair",
    "description": "Annual science fair competition",
    "activity_type": "competition",
    "class_division_id": "YOUR_CLASS_DIVISION_ID",
    "date": "2024-02-15",
    "time": "09:00",
    "venue": "School Auditorium",
    "required_items": ["Science project", "Display board"],
    "dress_code": "School uniform",
    "max_participants": 30
  }'
```

### Get Activity Details

```bash
curl -X GET http://localhost:3000/api/activities/YOUR_ACTIVITY_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Update Activity

```bash
curl -X PUT http://localhost:3000/api/activities/YOUR_ACTIVITY_ID \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated Activity Title",
    "description": "Updated description",
    "date": "2024-02-20",
    "time": "10:00"
  }'
```

### Delete Activity

```bash
curl -X DELETE http://localhost:3000/api/activities/YOUR_ACTIVITY_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Add Participants to Activity

```bash
curl -X POST http://localhost:3000/api/activities/YOUR_ACTIVITY_ID/participants \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "student_ids": ["STUDENT_ID_1", "STUDENT_ID_2", "STUDENT_ID_3"]
  }'
```

---

## 9. Feedback System Tests

### Get Feedback Categories

```bash
curl -X GET http://localhost:3000/api/feedback/categories \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### List Feedback

```bash
curl -X GET "http://localhost:3000/api/feedback?status=pending&priority=medium" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Submit Feedback

```bash
curl -X POST http://localhost:3000/api/feedback \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Feedback Title",
    "description": "Detailed feedback description",
    "category_id": "YOUR_CATEGORY_ID",
    "priority": "medium"
  }'
```

### Get Feedback Details

```bash
curl -X GET http://localhost:3000/api/feedback/YOUR_FEEDBACK_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Update Feedback Status

```bash
curl -X PUT http://localhost:3000/api/feedback/YOUR_FEEDBACK_ID/status \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "in_progress",
    "assigned_to": "ADMIN_USER_ID"
  }'
```

### Add Response to Feedback

```bash
curl -X POST http://localhost:3000/api/feedback/YOUR_FEEDBACK_ID/responses \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Thank you for your feedback. We will address this issue."
  }'
```

### Update Feedback

```bash
curl -X PUT http://localhost:3000/api/feedback/YOUR_FEEDBACK_ID \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated Feedback Title",
    "description": "Updated description",
    "priority": "high"
  }'
```

### Delete Feedback

```bash
curl -X DELETE http://localhost:3000/api/feedback/YOUR_FEEDBACK_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Testing Instructions

1. **Replace Placeholders**: Replace all `YOUR_TOKEN`, `YOUR_CLASS_DIVISION_ID`, `YOUR_STUDENT_ID`, etc. with actual values from your database.

2. **Test Order**: Test endpoints in this order:
   - Messages (create → list → approve/reject)
   - Leave Requests (create → list → update status)
   - Calendar (create → list → delete)
   - Alerts (create → list → approve/reject → send)
   - Chat (create thread → send message → list messages)
   - Lists (uniforms, books, staff - CRUD operations)
   - Analytics (summary → daily → generate report)
   - Activities (create → list → update → delete)
   - Feedback (submit → list → respond → update)

3. **Token Requirements**: Make sure you have valid JWT tokens for different user roles:
   - Admin token for all operations
   - Teacher token for class-specific operations
   - Parent token for parent-specific operations

4. **Database Setup**: Run the SQL files in Supabase before testing:

   ```sql
   -- Run these in order in Supabase SQL Editor
   ACTIVITY_SETUP.sql
   ALERTS_SETUP.sql
   ANALYTICS_SETUP.sql
   CHAT_SETUP.sql
   FEEDBACK_SETUP.sql
   LISTS_SETUP.sql
   ```

5. **Error Handling**: Check response status codes and error messages for debugging.

---

## Expected Response Formats

All endpoints should return responses in this format:

```json
{
  "status": "success",
  "data": {
    // Response data here
  }
}
```

Error responses:

```json
{
  "status": "error",
  "message": "Error description"
}
```
