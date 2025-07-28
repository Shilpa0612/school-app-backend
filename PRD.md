# School App - Product Requirements Document (PRD)

## 1. Introduction

The School App is a comprehensive mobile and web-based platform designed for educational institutions to facilitate communication between school administration, teachers, and parents. The application supports multiple user roles, real-time communication, and multilingual interfaces.

## 2. Technical Stack

- **Backend**: Node.js with Express.js
- **Database**: Supabase (PostgreSQL)
- **Mobile Frontend**: React Native
- **Web Frontend**: React.js/Next.js
- **Real-time Communication**: Supabase Realtime
- **File Storage**: Supabase Storage
- **Authentication**: Supabase Auth with custom phone number authentication
- **Push Notifications**: Firebase Cloud Messaging (FCM)

## 3. Database Schema

### Users Table

```sql
users
- id (uuid, primary key)
- phone_number (string, unique)
- password_hash (string)
- role (enum: admin, principal, teacher, parent)
- full_name (string)
- email (string, optional)
- preferred_language (enum: english, hindi, marathi)
- created_at (timestamp)
- last_login (timestamp)
```

### Students Table

```sql
students
- id (uuid, primary key)
- full_name (string)
- class_id (uuid, foreign key)
- roll_number (string)
- admission_number (string)
- created_at (timestamp)
```

### Parent-Student Mapping Table

```sql
parent_student_mappings
- id (uuid, primary key)
- parent_id (uuid, foreign key)
- student_id (uuid, foreign key)
- relationship (string)
- is_primary_guardian (boolean)
```

### Classes Table

```sql
classes
- id (uuid, primary key)
- name (string)
- section (string)
- teacher_id (uuid, foreign key)
- academic_year (string)
```

### Messages Table

```sql
messages
- id (uuid, primary key)
- sender_id (uuid, foreign key)
- class_id (uuid, foreign key, optional)
- recipient_id (uuid, foreign key, optional)
- content (text)
- type (enum: individual, group, announcement)
- status (enum: pending, approved, rejected)
- approved_by (uuid, foreign key)
- created_at (timestamp)
```

### Homework Table

```sql
homework
- id (uuid, primary key)
- class_id (uuid, foreign key)
- teacher_id (uuid, foreign key)
- subject (string)
- title (string)
- description (text)
- due_date (date)
- created_at (timestamp)
```

### Homework Attachments Table

```sql
homework_attachments
- id (uuid, primary key)
- homework_id (uuid, foreign key)
- file_url (string)
- file_type (string)
- file_name (string)
```

### Calendar Events Table

```sql
calendar_events
- id (uuid, primary key)
- title (string)
- description (text)
- event_date (date)
- created_by (uuid, foreign key)
- created_at (timestamp)
```

### Leave Requests Table

```sql
leave_requests
- id (uuid, primary key)
- student_id (uuid, foreign key)
- requested_by (uuid, foreign key)
- start_date (date)
- end_date (date)
- reason (text)
- status (enum: pending, approved, rejected)
- approved_by (uuid, foreign key)
- created_at (timestamp)
```

## 4. API Endpoints

### Authentication

- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/verify-otp
- POST /api/auth/reset-password

### User Management

- GET /api/users/profile
- PUT /api/users/profile
- GET /api/users/children (for parents)

### Messages

- POST /api/messages
- GET /api/messages
- PUT /api/messages/:id/approve
- PUT /api/messages/:id/reject

### Homework

- POST /api/homework
- GET /api/homework
- GET /api/homework/:id
- POST /api/homework/:id/attachments

### Calendar

- POST /api/calendar/events
- GET /api/calendar/events
- DELETE /api/calendar/events/:id

### Leave Requests

- POST /api/leave-requests
- GET /api/leave-requests
- PUT /api/leave-requests/:id/status

## 5. Real-time Features

Using Supabase Realtime for:

- Message delivery and status updates
- Homework notifications
- Leave request status changes
- Calendar event updates

## 6. Security Requirements

- Role-based access control (RBAC)
- Password hashing using bcrypt
- JWT-based authentication
- File upload validation and sanitization
- Input validation and sanitization
- Rate limiting for API endpoints
- Secure WebSocket connections

## 7. Mobile App Features

### Common Features

- Multi-language support (Hindi, English, Marathi)
- Push notifications
- File viewing and download
- Profile management
- Password change

### Parent Features

- View multiple children's information
- Chat with teachers
- View homework and submissions
- Submit leave requests
- View calendar events
- Download study materials

### Teacher Features

- Class management
- Post homework and materials
- Chat with parents
- Approve leave requests
- View class calendar
- Post announcements (requires approval)

## 8. Web Dashboard Features

### Admin Dashboard

- User management
- School-wide announcements
- Calendar management
- Reports and analytics
- Message moderation
- System configuration

### Principal Dashboard

- Message approval system
- School performance metrics
- Teacher activity monitoring
- Calendar management
- Report generation

## 9. Backup and Recovery

- Weekly automated backups using Supabase
- Point-in-time recovery capability
- Backup encryption
- Automated backup testing

## 10. Analytics and Reporting

- Daily usage statistics
- Message engagement metrics
- Homework completion rates
- User activity logs
- Custom report generation

## 11. Performance Requirements

- API response time < 500ms
- Real-time message delivery < 2s
- Support for 1000+ concurrent users
- File upload size limit: 10MB
- 99.9% uptime

## 12. Testing Requirements

- Unit testing for all API endpoints
- Integration testing for critical flows
- Mobile app testing on various devices
- Load testing for concurrent users
- Security penetration testing

## 13. Deployment Strategy

- CI/CD pipeline setup
- Staging and production environments
- Automated deployment process
- Version control using Git
- Feature flags for gradual rollout

## 14. Monitoring and Logging

- Error tracking and reporting
- Performance monitoring
- User activity logging
- API usage monitoring
- Real-time alert system

## 15. Future Considerations

- Support for multiple schools
- Video conferencing integration
- Online fee payment
- Student attendance system
- Academic performance tracking

## 16. Success Metrics

- User adoption rate
- Message response times
- System uptime
- User satisfaction ratings
- Feature usage statistics
