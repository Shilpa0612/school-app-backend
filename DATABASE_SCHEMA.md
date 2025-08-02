# Database Schema Documentation

This document provides a comprehensive overview of all database tables in the School App Backend system.

## Table of Contents

1. [Core Tables](#core-tables)
2. [Academic Management](#academic-management)
3. [User Management](#user-management)
4. [Student Management](#student-management)
5. [Communication](#communication)
6. [Academic Activities](#academic-activities)
7. [Administrative](#administrative)
8. [Storage & Logging](#storage--logging)

---

## Core Tables

### 1. school_details

Stores basic information about the school.

| Column           | Type                     | Constraints                             | Description                          |
| ---------------- | ------------------------ | --------------------------------------- | ------------------------------------ |
| `id`             | UUID                     | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique identifier                    |
| `name`           | TEXT                     | NOT NULL                                | School name                          |
| `address`        | TEXT                     | NOT NULL                                | School address                       |
| `contact_number` | TEXT                     | NOT NULL                                | School contact number                |
| `email`          | TEXT                     | NOT NULL                                | School email address                 |
| `board`          | TEXT                     | NOT NULL                                | Educational board (e.g., CBSE, ICSE) |
| `created_at`     | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT now()                 | Record creation timestamp            |

**Indexes:**

- Primary key on `id`

**RLS Policies:**

- Anyone can view school details
- Only admin can modify school details

---

## Academic Management

### 2. academic_years

Manages different academic years in the school.

| Column       | Type                     | Constraints                             | Description                               |
| ------------ | ------------------------ | --------------------------------------- | ----------------------------------------- |
| `id`         | UUID                     | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique identifier                         |
| `year_name`  | TEXT                     | NOT NULL, UNIQUE                        | Academic year name (e.g., "2023-24")      |
| `start_date` | DATE                     | NOT NULL                                | Academic year start date                  |
| `end_date`   | DATE                     | NOT NULL                                | Academic year end date                    |
| `is_active`  | BOOLEAN                  | DEFAULT false                           | Whether this is the current academic year |
| `created_at` | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT now()                 | Record creation timestamp                 |

**Indexes:**

- Primary key on `id`
- Unique index on `is_active` (only one active year allowed)
- Index on `year_name`

**Constraints:**

- `end_date` must be after `start_date`

**RLS Policies:**

- Anyone can view academic years
- Admin can manage academic years

### 3. class_levels

Defines different class levels (e.g., Class 1, Class 2, etc.).

| Column            | Type                     | Constraints                             | Description                        |
| ----------------- | ------------------------ | --------------------------------------- | ---------------------------------- |
| `id`              | UUID                     | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique identifier                  |
| `name`            | TEXT                     | NOT NULL, UNIQUE                        | Class level name (e.g., "Class 1") |
| `sequence_number` | INTEGER                  | NOT NULL                                | Ordering sequence for class levels |
| `created_at`      | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT now()                 | Record creation timestamp          |

**Indexes:**

- Primary key on `id`
- Unique index on `name`

**RLS Policies:**

- Anyone can view class levels
- Admin can manage class levels

### 4. class_divisions

Represents specific class divisions within an academic year.

| Column             | Type                     | Constraints                             | Description                    |
| ------------------ | ------------------------ | --------------------------------------- | ------------------------------ |
| `id`               | UUID                     | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique identifier              |
| `academic_year_id` | UUID                     | FOREIGN KEY → academic_years(id)        | Reference to academic year     |
| `class_level_id`   | UUID                     | FOREIGN KEY → class_levels(id)          | Reference to class level       |
| `division`         | TEXT                     | NOT NULL                                | Division name (e.g., "A", "B") |
| `teacher_id`       | UUID                     | FOREIGN KEY → users(id)                 | Class teacher assignment       |
| `created_at`       | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT now()                 | Record creation timestamp      |

**Indexes:**

- Primary key on `id`
- Unique constraint on (academic_year_id, class_level_id, division)
- Index on `academic_year_id`
- Index on `teacher_id`

**RLS Policies:**

- Anyone can view class divisions
- Admin and Principal can manage class divisions

### 5. teacher_class_assignments

Tracks teacher assignments to specific classes and subjects.

| Column             | Type                     | Constraints                             | Description                             |
| ------------------ | ------------------------ | --------------------------------------- | --------------------------------------- |
| `id`               | UUID                     | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique identifier                       |
| `teacher_id`       | UUID                     | FOREIGN KEY → users(id)                 | Reference to teacher                    |
| `academic_year`    | TEXT                     | NOT NULL                                | Academic year                           |
| `class_level`      | TEXT                     | NOT NULL                                | Class level                             |
| `division`         | TEXT                     | NOT NULL                                | Division                                |
| `subject`          | TEXT                     | NULL                                    | Subject taught (NULL for class teacher) |
| `is_class_teacher` | BOOLEAN                  | DEFAULT false                           | Whether teacher is class teacher        |
| `created_at`       | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT now()                 | Record creation timestamp               |

**Indexes:**

- Primary key on `id`
- Unique constraint on (teacher_id, academic_year, class_level, division, subject)
- Index on `teacher_id`
- Index on `academic_year`
- Index on `class_level`, `division`

**RLS Policies:**

- Anyone can view teacher assignments
- Admin and Principal can manage teacher assignments

---

## User Management

### 6. users

Stores all user accounts in the system.

| Column               | Type                     | Constraints                                                           | Description                |
| -------------------- | ------------------------ | --------------------------------------------------------------------- | -------------------------- |
| `id`                 | UUID                     | PRIMARY KEY, DEFAULT uuid_generate_v4()                               | Unique identifier          |
| `phone_number`       | TEXT                     | NOT NULL, UNIQUE                                                      | User's phone number        |
| `password_hash`      | TEXT                     | NOT NULL                                                              | Hashed password            |
| `role`               | TEXT                     | NOT NULL, CHECK (role IN ('admin', 'principal', 'teacher', 'parent')) | User role                  |
| `full_name`          | TEXT                     | NOT NULL                                                              | User's full name           |
| `email`              | TEXT                     | NULL                                                                  | User's email address       |
| `preferred_language` | TEXT                     | DEFAULT 'english', CHECK (IN ('english', 'hindi', 'marathi'))         | Preferred language         |
| `created_at`         | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT now()                                               | Account creation timestamp |
| `last_login`         | TIMESTAMP WITH TIME ZONE | NULL                                                                  | Last login timestamp       |

**Indexes:**

- Primary key on `id`
- Unique index on `phone_number`
- Index on `role`

**RLS Policies:**

- Users can view their own data
- Admin can manage all users

---

## Student Management

### 7. students_master

Master table containing all student information.

| Column             | Type                     | Constraints                                                                     | Description                |
| ------------------ | ------------------------ | ------------------------------------------------------------------------------- | -------------------------- |
| `id`               | UUID                     | PRIMARY KEY, DEFAULT uuid_generate_v4()                                         | Unique identifier          |
| `admission_number` | TEXT                     | NOT NULL, UNIQUE                                                                | Student's admission number |
| `full_name`        | TEXT                     | NOT NULL                                                                        | Student's full name        |
| `date_of_birth`    | DATE                     | NOT NULL                                                                        | Student's date of birth    |
| `admission_date`   | DATE                     | NOT NULL                                                                        | Date of admission          |
| `status`           | TEXT                     | DEFAULT 'active', CHECK (IN ('active', 'transferred', 'graduated', 'inactive')) | Student status             |
| `created_at`       | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT now()                                                         | Record creation timestamp  |

**Indexes:**

- Primary key on `id`
- Unique index on `admission_number`

**RLS Policies:**

- Admin and teachers can view students
- Admin can manage students

### 8. student_academic_records

Tracks student enrollment in specific classes across academic years.

| Column              | Type                     | Constraints                                                                      | Description                    |
| ------------------- | ------------------------ | -------------------------------------------------------------------------------- | ------------------------------ |
| `id`                | UUID                     | PRIMARY KEY, DEFAULT uuid_generate_v4()                                          | Unique identifier              |
| `student_id`        | UUID                     | FOREIGN KEY → students_master(id)                                                | Reference to student           |
| `academic_year_id`  | UUID                     | FOREIGN KEY → academic_years(id)                                                 | Reference to academic year     |
| `class_division_id` | UUID                     | FOREIGN KEY → class_divisions(id)                                                | Reference to class division    |
| `roll_number`       | TEXT                     | NULL                                                                             | Student's roll number in class |
| `status`            | TEXT                     | DEFAULT 'ongoing', CHECK (IN ('ongoing', 'promoted', 'detained', 'transferred')) | Academic status                |
| `created_at`        | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT now()                                                          | Record creation timestamp      |

**Indexes:**

- Primary key on `id`
- Unique constraint on (student_id, academic_year_id)
- Index on `student_id`
- Index on `academic_year_id`
- Index on `class_division_id`
- Index on `status`
- Unique index on (class_division_id, roll_number) where status = 'ongoing'

**RLS Policies:**

- Teachers can view their class records
- Parents can view their children's records
- Admin and Principal can view all records

### 9. parent_student_mappings

Links parents to their children with relationship details.

| Column                | Type                     | Constraints                                                   | Description                          |
| --------------------- | ------------------------ | ------------------------------------------------------------- | ------------------------------------ |
| `id`                  | UUID                     | PRIMARY KEY, DEFAULT uuid_generate_v4()                       | Unique identifier                    |
| `parent_id`           | UUID                     | FOREIGN KEY → users(id)                                       | Reference to parent user             |
| `student_id`          | UUID                     | FOREIGN KEY → students_master(id)                             | Reference to student                 |
| `relationship`        | TEXT                     | NOT NULL, CHECK (IN ('father', 'mother', 'guardian'))         | Relationship type                    |
| `is_primary_guardian` | BOOLEAN                  | DEFAULT false                                                 | Whether this is the primary guardian |
| `access_level`        | TEXT                     | DEFAULT 'full', CHECK (IN ('full', 'restricted', 'readonly')) | Access level for parent              |
| `created_at`          | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT now()                                       | Record creation timestamp            |
| `updated_at`          | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT now()                                       | Record update timestamp              |

**Indexes:**

- Primary key on `id`
- Unique constraint on (parent_id, student_id)
- Index on `parent_id`
- Index on `student_id`
- Index on `is_primary_guardian`
- Index on `relationship`
- Unique index on `student_id` where `is_primary_guardian = true`

**Constraints:**

- Only one primary guardian per student allowed

**RLS Policies:**

- Parents can view their own mappings
- Admin can manage parent-student mappings

---

## Communication

### 10. messages

Internal messaging system with approval workflow.

| Column              | Type                     | Constraints                                                                 | Description                                 |
| ------------------- | ------------------------ | --------------------------------------------------------------------------- | ------------------------------------------- |
| `id`                | UUID                     | PRIMARY KEY, DEFAULT uuid_generate_v4()                                     | Unique identifier                           |
| `sender_id`         | UUID                     | FOREIGN KEY → users(id)                                                     | Message sender                              |
| `class_division_id` | UUID                     | FOREIGN KEY → class_divisions(id)                                           | Target class (for group messages)           |
| `recipient_id`      | UUID                     | FOREIGN KEY → users(id)                                                     | Message recipient (for individual messages) |
| `content`           | TEXT                     | NOT NULL                                                                    | Message content                             |
| `type`              | TEXT                     | NOT NULL, CHECK (IN ('individual', 'group', 'announcement'))                | Message type                                |
| `status`            | TEXT                     | NOT NULL, DEFAULT 'pending', CHECK (IN ('pending', 'approved', 'rejected')) | Approval status                             |
| `approved_by`       | UUID                     | FOREIGN KEY → users(id)                                                     | User who approved/rejected                  |
| `created_at`        | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT now()                                                     | Message creation timestamp                  |

**Indexes:**

- Primary key on `id`
- Index on `sender_id`
- Index on `class_division_id`
- Index on `type`
- Index on `created_at`

**RLS Policies:**

- Row Level Security enabled (policies defined in setup)

---

## Academic Activities

### 11. homework

Stores homework assignments for classes.

| Column              | Type                     | Constraints                                 | Description                      |
| ------------------- | ------------------------ | ------------------------------------------- | -------------------------------- |
| `id`                | UUID                     | PRIMARY KEY, DEFAULT uuid_generate_v4()     | Unique identifier                |
| `class_division_id` | UUID                     | FOREIGN KEY → class_divisions(id), NOT NULL | Target class division            |
| `teacher_id`        | UUID                     | FOREIGN KEY → users(id), NOT NULL           | Teacher who created the homework |
| `subject`           | TEXT                     | NOT NULL                                    | Subject for the homework         |
| `title`             | TEXT                     | NOT NULL                                    | Homework title                   |
| `description`       | TEXT                     | NOT NULL                                    | Homework description             |
| `due_date`          | TIMESTAMP WITH TIME ZONE | NOT NULL                                    | Due date for homework            |
| `created_at`        | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT now()                     | Creation timestamp               |

**Indexes:**

- Primary key on `id`
- Index on `class_division_id`
- Index on `teacher_id`
- Index on `subject`
- Index on `due_date`

**RLS Policies:**

- Teachers can manage their class homework
- Admin and Principal can view all homework
- Parents can view homework for their children's classes

### 12. homework_files

Stores file attachments for homework assignments.

| Column         | Type                     | Constraints                                          | Description                |
| -------------- | ------------------------ | ---------------------------------------------------- | -------------------------- |
| `id`           | UUID                     | PRIMARY KEY, DEFAULT uuid_generate_v4()              | Unique identifier          |
| `homework_id`  | UUID                     | FOREIGN KEY → homework(id), NOT NULL, CASCADE DELETE | Reference to homework      |
| `storage_path` | TEXT                     | NOT NULL                                             | File path in storage       |
| `file_name`    | TEXT                     | NOT NULL                                             | Original file name         |
| `file_type`    | TEXT                     | NOT NULL                                             | File MIME type             |
| `file_size`    | BIGINT                   | NOT NULL                                             | File size in bytes         |
| `uploaded_by`  | UUID                     | FOREIGN KEY → users(id), NOT NULL                    | User who uploaded the file |
| `created_at`   | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT now()                              | Upload timestamp           |

**Indexes:**

- Primary key on `id`
- Index on `homework_id`
- Index on `uploaded_by`

**RLS Policies:**

- Row Level Security enabled (policies defined in setup)

---

## Administrative

### 13. calendar_events

School calendar events and important dates.

| Column        | Type                     | Constraints                             | Description                |
| ------------- | ------------------------ | --------------------------------------- | -------------------------- |
| `id`          | UUID                     | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique identifier          |
| `title`       | TEXT                     | NOT NULL                                | Event title                |
| `description` | TEXT                     | NOT NULL                                | Event description          |
| `event_date`  | TIMESTAMP WITH TIME ZONE | NOT NULL                                | Event date and time        |
| `created_by`  | UUID                     | FOREIGN KEY → users(id), NOT NULL       | User who created the event |
| `created_at`  | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT now()                 | Creation timestamp         |

**Indexes:**

- Primary key on `id`
- Index on `event_date`
- Index on `created_by`

**RLS Policies:**

- Row Level Security enabled (policies defined in setup)

### 14. leave_requests

Student leave request management system.

| Column         | Type                     | Constraints                                                                 | Description                    |
| -------------- | ------------------------ | --------------------------------------------------------------------------- | ------------------------------ |
| `id`           | UUID                     | PRIMARY KEY, DEFAULT uuid_generate_v4()                                     | Unique identifier              |
| `student_id`   | UUID                     | FOREIGN KEY → students_master(id), NOT NULL                                 | Student requesting leave       |
| `requested_by` | UUID                     | FOREIGN KEY → users(id), NOT NULL                                           | User who submitted the request |
| `start_date`   | DATE                     | NOT NULL                                                                    | Leave start date               |
| `end_date`     | DATE                     | NOT NULL                                                                    | Leave end date                 |
| `reason`       | TEXT                     | NOT NULL                                                                    | Reason for leave               |
| `status`       | TEXT                     | NOT NULL, DEFAULT 'pending', CHECK (IN ('pending', 'approved', 'rejected')) | Request status                 |
| `approved_by`  | UUID                     | FOREIGN KEY → users(id)                                                     | User who approved/rejected     |
| `created_at`   | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT now()                                                     | Request creation timestamp     |

**Indexes:**

- Primary key on `id`
- Index on `student_id`
- Index on `requested_by`
- Index on `status`

**Constraints:**

- `end_date` must be greater than or equal to `start_date`

**RLS Policies:**

- Row Level Security enabled (policies defined in setup)

---

## Storage & Logging

### 15. file_access_logs

Tracks file access for audit purposes.

| Column        | Type                     | Constraints                                      | Description                |
| ------------- | ------------------------ | ------------------------------------------------ | -------------------------- |
| `id`          | UUID                     | PRIMARY KEY, DEFAULT uuid_generate_v4()          | Unique identifier          |
| `file_path`   | TEXT                     | NOT NULL                                         | Path of accessed file      |
| `accessed_by` | UUID                     | FOREIGN KEY → users(id), NOT NULL                | User who accessed the file |
| `access_type` | TEXT                     | NOT NULL, CHECK (IN ('read', 'write', 'delete')) | Type of access             |
| `created_at`  | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT now()                          | Access timestamp           |

**Indexes:**

- Primary key on `id`
- Index on `file_path`
- Index on `access_type`
- Index on `accessed_by`

**RLS Policies:**

- Row Level Security enabled (policies defined in setup)

---

## Storage Buckets

The system uses Supabase Storage with the following buckets:

1. **homework-attachments** (private)
   - Stores homework-related file attachments
   - Access controlled by RLS policies

2. **profile-pictures** (private)
   - Stores user profile pictures
   - Access controlled by RLS policies

---

## Key Functions

### Academic Management Functions

1. **promote_students(p_from_academic_year_id, p_to_academic_year_id)**
   - Promotes students from one academic year to the next
   - Returns promotion status for each student

2. **assign_student_to_class(p_student_id, p_class_division_id, p_roll_number)**
   - Assigns a student to a specific class division
   - Automatically uses the active academic year

3. **assign_teacher_to_class(p_teacher_id, p_academic_year, p_class_level, p_division, p_subject, p_is_class_teacher)**
   - Assigns teachers to specific classes and subjects
   - Handles class teacher assignments

4. **get_student_history(p_student_id)**
   - Returns complete academic history for a student
   - Includes class teachers and academic status

### Setup Functions

1. **setup_school(admin_data, school_data)**
   - Initializes the school system
   - Creates first admin user and school details
   - Can only be run once

2. **initialize_school_year(p_year_name, p_start_date, p_end_date)**
   - Creates a new academic year
   - Deactivates previous active year

---

## Database Constraints

### Unique Constraints

- Only one active academic year at a time
- Unique admission numbers for students
- One student per academic year
- One primary guardian per student
- Unique roll numbers within active class divisions
- Unique parent-student mappings

### Check Constraints

- Valid user roles: admin, principal, teacher, parent
- Valid student statuses: active, transferred, graduated, inactive
- Valid academic statuses: ongoing, promoted, detained, transferred
- Valid message types: individual, group, announcement
- Valid message statuses: pending, approved, rejected
- Valid leave request statuses: pending, approved, rejected
- Valid access types: read, write, delete
- Valid relationships: father, mother, guardian
- Valid access levels: full, restricted, readonly
- Valid preferred languages: english, hindi, marathi

### Foreign Key Relationships

- All foreign keys have appropriate CASCADE or RESTRICT delete behaviors
- Referential integrity is maintained across all tables

---

## Performance Considerations

### Indexes

- Primary keys on all tables
- Foreign key indexes for join performance
- Composite indexes for common query patterns
- Partial indexes for filtered queries

### Row Level Security (RLS)

- All tables have RLS enabled
- Policies ensure data access based on user roles
- Parents can only access their children's data
- Teachers can only access their class data
- Admins have full access to all data

### Triggers

- Automatic timestamp updates
- File access logging
- Parent-student relationship validation

---

## Migration Notes

When updating the database schema:

1. **Backup existing data** before running migrations
2. **Test migrations** in a development environment first
3. **Update RLS policies** if table structure changes
4. **Verify foreign key relationships** after schema changes
5. **Update application code** to match new schema if needed

---

## Security Considerations

1. **Row Level Security (RLS)** is enabled on all tables
2. **Password hashing** is handled at the application level
3. **JWT tokens** are used for authentication
4. **File access** is controlled through storage policies
5. **Audit logging** tracks file access and important operations

---

_Last updated: [Current Date]_
_Schema version: V2_
