## API Calls Mapped to Tasks (Sequential)

Notes

- Base URL prefix: `/api`
- Academic routes are prefixed with `/api/academic`
- Auth required unless noted; role-based access is indicated

### High Priority (Week 1-2)

#### Task 1: Teacher Assignment to Classes

- GET `/api/academic/teachers`
  - List teachers for assignment (admin/principal/teacher)
- GET `/api/academic/class-divisions`
  - List class divisions, filter by `academic_year_id`
- GET `/api/academic/class-divisions/:class_division_id/teachers`
  - List all teachers assigned to the class (many-to-many). Returns `assignment_id`, `assignment_type`, `is_primary`
- POST `/api/academic/class-divisions/:class_division_id/assign-teacher`
  - Body: `{ "teacher_id": "uuid", "assignment_type": "class_teacher|subject_teacher|assistant_teacher|substitute_teacher", "is_primary": boolean }`
  - Assign teacher to class. Use `is_primary: true` only if no primary exists yet
- PUT `/api/academic/class-divisions/:class_division_id/teacher-assignment/:assignment_id`
  - Body: `{ "assignment_type"?: string, "is_primary"?: boolean }`
  - Update assignment (e.g., promote/demote primary, change type)
- DELETE `/api/academic/class-divisions/:class_division_id/remove-teacher/:teacher_id`
  - Optional query: `?assignment_type=subject_teacher`
  - Soft-remove (deactivate) the assignment(s)
- GET `/api/academic/teachers/:teacher_id/classes`
  - View all classes a teacher is assigned to, with assignment details

#### Task 2: Parent-Student Linking

- POST `/api/academic/link-students`
  - Body: `{ "parent_id": "uuid", "students": [{ "student_id": "uuid", "relationship": "father|mother|guardian", "is_primary_guardian": boolean, "access_level": "full|restricted|readonly" }] }`
  - Link multiple students to a parent
- PUT `/api/academic/update-parent-access/:mapping_id`
  - Body: `{ "is_primary_guardian"?: boolean, "access_level"?: string, "relationship"?: string }`
  - Update a parent-student mapping
- DELETE `/api/users/mappings/:mapping_id`
  - Remove a parent-student mapping (parent owns mapping, or admin/principal)
- GET `/api/users/children` (parent)
  - Returns children with current class and teacher info
- GET `/api/users?role=parent&search=...` (admin/principal)
  - Use for finding parents (server-side search)

### Medium Priority (Week 3-4)

#### Task 3: Reporting & Analytics Dashboard

- GET `/api/analytics/summary` (admin/principal)
- GET `/api/analytics/daily` (admin/principal)
  - Query: `date_from`, `date_to`, `page`, `limit`
- POST `/api/analytics/reports` (admin/principal)
  - Body: `{ "report_type": string, "date_from": string, "date_to": string, "filters"?: object }`
- GET `/api/analytics/reports` (admin/principal)
- GET `/api/analytics/reports/:id` (admin/principal)

#### Task 4: Bulk Operations (UI-only per plan)

- No bulk import/create APIs exist yet. See Missing APIs at bottom

### Low Priority (Week 5)

#### Task 5: Enhanced Academic Structure Features

- Class Levels
  - POST `/api/academic/class-levels` (admin/principal)
  - GET `/api/academic/class-levels`
  - PUT `/api/academic/class-levels/:id` (admin/principal)
  - DELETE `/api/academic/class-levels/:id` (admin/principal)
- Class Divisions
  - POST `/api/academic/class-divisions` (admin/principal)
  - GET `/api/academic/class-divisions`
  - GET `/api/academic/class-divisions/:class_division_id/teachers`
  - [Legacy] PUT `/api/academic/class-divisions/:id` — supports division rename; avoid sending `teacher_id` (use many-to-many endpoints instead)
  - DELETE `/api/academic/class-divisions/:id` (admin/principal)

#### Task 6: Final Testing & Optimization

- Debug/health helpers
  - GET `/api/academic/debug/database-structure` (admin/principal)
  - GET `/api/users/debug/database` (authenticated)

### Phase 2: Academic Activities (Weeks 3-4)

#### Homework Management

- POST `/api/homework` (teacher)
- GET `/api/homework`
  - Query: `class_division_id`, `subject`, `teacher_id` (admin/principal), `academic_year_id`, `class_level_id`, `due_date_from`, `due_date_to`, `status`, `page`, `limit`
- GET `/api/homework/:id`
- GET `/api/homework/filters`
- POST `/api/homework/:id/attachments` (form-data)

#### Classwork Management

- POST `/api/classwork` (teacher)
- GET `/api/classwork`
  - Query: `class_division_id`, `subject`, `date_from`, `date_to`, `page`, `limit`
- GET `/api/classwork/:id`
- PUT `/api/classwork/:id` (teacher)
- DELETE `/api/classwork/:id` (teacher)
- POST `/api/classwork/:id/attachments` (form-data)
- GET `/api/classwork/class/:class_division_id`
  - Query: `date_from`, `date_to`, `page`, `limit`

### Phase 3: Communication System (Weeks 5-6)

#### Messaging System

- POST `/api/messages` (teacher)
- GET `/api/messages` (authenticated)
  - Query: `status`, `class_division_id`, `child_id`/`student_id`
- PUT `/api/messages/:id/approve` (admin/principal)
- PUT `/api/messages/:id/reject` (admin/principal)

#### Calendar & Events

- POST `/api/calendar/events` (admin/principal/teacher)
- GET `/api/calendar/events`
  - Query: `start_date`, `end_date`, `class_division_id`, `event_type`, `event_category`, `use_ist`
- GET `/api/calendar/events/:id`
  - Query: `use_ist`
- PUT `/api/calendar/events/:id` (creator or admin/principal)
- DELETE `/api/calendar/events/:id` (creator or admin/principal)
- GET `/api/calendar/events/class/:class_division_id`
  - Query: `date_from`, `date_to`, `page`, `limit`
- GET `/api/calendar/events/parent` (parent)
  - Query: `start_date`, `end_date`, `event_category`, `use_ist`

### Phase 4: Administrative Features (Weeks 7-8)

#### Leave Management

- POST `/api/leave-requests` (teacher/principal)
- GET `/api/leave-requests` (teacher/principal/admin)
  - Query: `status`
- PUT `/api/leave-requests/:id/status` (teacher/principal/admin)
  - Body: `{ "status": "approved" | "rejected" }`

#### Resource Management (Uniforms, Books, Staff)

- Uniforms
  - GET `/api/lists/uniforms`
  - POST `/api/lists/uniforms` (admin/principal)
  - PUT `/api/lists/uniforms/:id` (admin/principal)
  - DELETE `/api/lists/uniforms/:id` (admin/principal)
- Books
  - GET `/api/lists/books`
  - POST `/api/lists/books` (admin/principal)
  - PUT `/api/lists/books/:id` (admin/principal)
  - DELETE `/api/lists/books/:id` (admin/principal)
- Staff
  - GET `/api/lists/staff`
  - POST `/api/lists/staff` (admin/principal)
  - PUT `/api/lists/staff/:id` (admin/principal)
  - DELETE `/api/lists/staff/:id` (admin/principal)
  - POST `/api/lists/staff/with-user` (admin/principal)
  - POST `/api/lists/staff/sync` (admin/principal)

### Phase 5: Enhancement & Optimization (Weeks 9-10)

#### Reporting & Analytics (Consolidation)

- Use endpoints listed under Task 3 above

#### Bulk Operations (Consolidation)

- See “Missing APIs” below (per TODO plan, UI-only for now)

#### Feedback System

- GET `/api/feedback/categories` (authenticated)
- GET `/api/feedback` (authenticated)
  - Query: `category_id`, `status`, `priority`, `page`, `limit`
- POST `/api/feedback` (authenticated)
- GET `/api/feedback/:id` (submitter/admin/principal)
- PUT `/api/feedback/:id/status` (admin/principal)
- POST `/api/feedback/:id/responses` (submitter/admin/principal)
- PUT `/api/feedback/:id` (submitter; pending only)
- DELETE `/api/feedback/:id` (submitter/admin/principal)

### Cross-cutting User/Student Operations

- Users
  - GET `/api/users` (admin/principal) — filters: `role`, `search`
  - GET `/api/users/profile` (authenticated)
  - PUT `/api/users/profile` (authenticated)
  - PUT `/api/users/:user_id` (admin/principal)
- Students
  - POST `/api/academic/students` (admin)
  - GET `/api/academic/students/:id` (authenticated)
  - GET `/api/academic/students/class/:class_division_id` (admin/principal/teacher)
  - GET `/api/academic/students/level/:class_level_id` (admin/principal)
  - GET `/api/academic/students/divisions/summary` (admin/principal)
  - GET `/api/academic/promotion-eligible/:academic_year_id` (admin/principal)
  - POST `/api/academic/promote-selected` (admin/principal)
  - GET `/api/academic/student-history/:student_id` (authenticated)

### Birthday Management

- GET `/api/birthdays/today` (admin/principal/teacher)
  - Query: `class_division_id?`, `page?`, `limit?`
- GET `/api/birthdays/upcoming` (admin/principal/teacher)
  - Query: `class_division_id?`, `page?`, `limit?`
- GET `/api/birthdays/statistics` (admin/principal)
- GET `/api/birthdays/class/:class_division_id` (teacher)
- GET `/api/birthdays/division/:class_division_id` (admin/principal/teacher)
  - Query: `date?`, `page?`, `limit?`

---

### Missing APIs (Not Present; Need to be Coded)

Bulk Operations

- [New] POST `/api/bulk/students` — bulk student import (CSV/JSON)
- [New] POST `/api/bulk/parents` — bulk parent import (CSV/JSON)
- [New] POST `/api/bulk/teachers` — bulk teacher/staff import (CSV/JSON)
- [New] GET `/api/bulk/imports/:id` — import job/status

Enhanced Academic Structure

- ✅ PUT `/api/academic/class-levels/:id` — update class level
- ✅ DELETE `/api/academic/class-levels/:id` — delete class level
- ✅ DELETE `/api/academic/class-divisions/:id` — delete class division

Teacher Assignment UX Helpers (optional)

- [New] GET `/api/academic/class-divisions/:id/teachers/subjects` — subject-wise teacher view
- [New] PUT `/api/academic/class-divisions/:id/primary-teacher` — atomic primary teacher switch helper

Parent Search/Helpers (optional)

- [New] GET `/api/parents/search?query=...` — dedicated parent search (wrapper over `/api/users`)
