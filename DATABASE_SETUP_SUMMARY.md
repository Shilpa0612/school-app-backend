# Database Setup Summary

## Files You Need to Paste in Supabase SQL Editor

### ✅ **Required Setup Files (in order)**

1. **ACTIVITY_SETUP.sql** - Activity planning system
2. **ALERTS_SETUP.sql** - Alerts system
3. **ANALYTICS_SETUP.sql** - Reports & analytics
4. **CHAT_SETUP.sql** - Chat system
5. **FEEDBACK_SETUP.sql** - Feedback system
6. **LISTS_SETUP.sql** - Lists management (uniforms, books, staff)

### ✅ **Already Included in SUPABASE_SETUP_V2.sql**

The following tables are already in your main setup file, so you **don't need** separate setup files for these:

- **Messages** (`public.messages`)
- **Leave Requests** (`public.leave_requests`)
- **Calendar Events** (`public.calendar_events`)
- **Homework** (`public.homework`)
- **Homework Files** (`public.homework_files`)
- **All core academic tables** (users, students, classes, etc.)

---

## Complete Setup Instructions

### Step 1: Run Main Setup (if not already done)

```sql
-- Run SUPABASE_SETUP_V2.sql first (if not already done)
-- This contains all core tables and functions
```

### Step 2: Run Additional Setup Files

```sql
-- Run these in order in Supabase SQL Editor:

-- 1. Activity Planning System
-- Copy and paste ACTIVITY_SETUP.sql

-- 2. Alerts System
-- Copy and paste ALERTS_SETUP.sql

-- 3. Reports & Analytics
-- Copy and paste ANALYTICS_SETUP.sql

-- 4. Chat System
-- Copy and paste CHAT_SETUP.sql

-- 5. Feedback System
-- Copy and paste FEEDBACK_SETUP.sql

-- 6. Lists Management
-- Copy and paste LISTS_SETUP.sql
```

---

## Tables Created by Each Setup File

### ACTIVITY_SETUP.sql

- `public.activities` - Activity planning
- `public.activity_items` - Activity checklist items
- `public.activity_participants` - Student participation
- `public.activity_reminders` - Activity reminders

### ALERTS_SETUP.sql

- `public.alerts` - Alert messages
- `public.alert_recipients` - Alert recipient tracking
- `public.alert_delivery_logs` - Delivery tracking

### ANALYTICS_SETUP.sql

- `public.user_activity_logs` - User activity tracking
- `public.daily_statistics` - Daily stats
- `public.report_templates` - Report templates
- `public.generated_reports` - Generated reports

### CHAT_SETUP.sql

- `public.chat_threads` - Chat conversations
- `public.chat_participants` - Thread participants
- `public.chat_messages` - Chat messages
- `public.chat_message_attachments` - Message files

### FEEDBACK_SETUP.sql

- `public.feedback_categories` - Feedback categories
- `public.feedback_submissions` - Feedback submissions
- `public.feedback_responses` - Admin responses
- `public.feedback_attachments` - Feedback files
- `public.feedback_status_history` - Status tracking

### LISTS_SETUP.sql

- `public.uniforms` - Uniform catalog
- `public.books` - Book catalog
- `public.staff` - Staff directory

---

## Verification Checklist

After running all setup files, you should have these tables:

### Core Tables (from SUPABASE_SETUP_V2.sql)

- ✅ `users`
- ✅ `students_master`
- ✅ `class_divisions`
- ✅ `messages`
- ✅ `leave_requests`
- ✅ `calendar_events`
- ✅ `homework`
- ✅ `homework_files`

### New Tables (from setup files)

- ✅ `activities`
- ✅ `activity_items`
- ✅ `activity_participants`
- ✅ `activity_reminders`
- ✅ `alerts`
- ✅ `alert_recipients`
- ✅ `alert_delivery_logs`
- ✅ `user_activity_logs`
- ✅ `daily_statistics`
- ✅ `report_templates`
- ✅ `generated_reports`
- ✅ `chat_threads`
- ✅ `chat_participants`
- ✅ `chat_messages`
- ✅ `chat_message_attachments`
- ✅ `feedback_categories`
- ✅ `feedback_submissions`
- ✅ `feedback_responses`
- ✅ `feedback_attachments`
- ✅ `feedback_status_history`
- ✅ `uniforms`
- ✅ `books`
- ✅ `staff`

---

## Testing Order

1. **Messages** (already in main setup)
2. **Leave Requests** (already in main setup)
3. **Calendar** (already in main setup)
4. **Alerts** (new setup)
5. **Chat** (new setup)
6. **Lists** (new setup)
7. **Analytics** (new setup)
8. **Activities** (new setup)
9. **Feedback** (new setup)

---

## Troubleshooting

### Common Issues:

1. **Permission Errors**: Make sure you're running as a database owner
2. **Duplicate Tables**: If tables already exist, you may need to drop them first
3. **RLS Policies**: Some policies might conflict - check error messages
4. **Functions**: If functions already exist, use `CREATE OR REPLACE`

### Error Resolution:

```sql
-- If you get "table already exists" errors:
DROP TABLE IF EXISTS public.table_name CASCADE;

-- If you get "function already exists" errors:
DROP FUNCTION IF EXISTS function_name CASCADE;

-- Then re-run the setup file
```
