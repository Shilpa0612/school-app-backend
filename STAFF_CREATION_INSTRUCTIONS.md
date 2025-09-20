# Staff Creation Instructions

## 📋 Overview

This guide provides instructions for creating 24 staff members with user credentials in the school system.

## 🔧 API Endpoint

**Endpoint:** `POST /api/lists/staff/with-user`  
**Method:** Individual creation (no bulk endpoint available)  
**Authentication:** Admin or Principal required

## 📁 Files Created

1. **`bulk_staff_creation_payloads.json`** - Contains all 24 staff payloads
2. **`STAFF_DATA_ISSUES_FOUND.md`** - Documents data corrections made
3. **`STAFF_CREATION_INSTRUCTIONS.md`** - This instruction guide

## 🚀 How to Create Staff

### Option 1: Manual API Calls (24 calls)

For each staff member, make an individual API call:

```bash
POST https://ajws-school-ba8ae5e3f955.herokuapp.com/api/lists/staff/with-user
Content-Type: application/json
Authorization: Bearer <your-auth-token>
```

**Example for Principal (Shilpa Lokhande):**

```json
{
  "full_name": "Shilpa Anand Lokhande",
  "phone_number": "9558037803",
  "email": "shilpaanandlokhande@gmail.com",
  "role": "teacher",
  "department": "Teaching",
  "designation": "Principal",
  "subject_specialization": "Mathematics, Science",
  "password": "Staff@123",
  "user_role": "principal"
}
```

### Option 2: Automated Script (Recommended)

I can create a Node.js script to automate all 24 API calls:

```javascript
// Run this script to create all staff automatically
const staffData = require("./bulk_staff_creation_payloads.json");

async function createAllStaff() {
  for (const staff of staffData.staff_payloads) {
    const response = await fetch(
      "https://ajws-school-ba8ae5e3f955.herokuapp.com/api/lists/staff/with-user",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer YOUR_AUTH_TOKEN",
        },
        body: JSON.stringify(staff.payload),
      }
    );

    const result = await response.json();
    console.log(`Staff ${staff.staff_id}: ${result.status}`);
  }
}
```

## 📊 Staff Summary

### By Designation:

- **Principal:** 1 (Shilpa Lokhande - user_role: principal)
- **Coordinator:** 1 (Sandesh Ingle)
- **Librarian:** 1 (Shakuntala Patil)
- **PET Teachers:** 4 (Physical Education specialists)
- **NTT Teachers:** 4 (Nursery Teacher Training)
- **PRT Teachers:** 7 (Primary Teachers)
- **TGT Teachers:** 7 (Trained Graduate Teachers)

### By Subject Specialization:

- **Mathematics:** 6 teachers
- **English:** 8 teachers
- **Science:** 4 teachers
- **Environmental Science:** 3 teachers
- **Hindi:** 3 teachers
- **Marathi:** 4 teachers
- **Physical Education:** 4 teachers
- **Biology:** 2 teachers
- **Physics:** 2 teachers
- **Social Studies:** 3 teachers

## 🔑 Login Credentials

All staff will have these login credentials:

- **Phone Number:** As provided in data
- **Password:** `Staff@123` (default for all)
- **Role:** `teacher` (except Principal who gets `principal` role)

### Special Cases:

- **Shilpa Anand Lokhande (Principal):** user_role = "principal"
- **All others:** user_role = "teacher"

## ✅ Data Corrections Applied

### Fixed Issues:

1. **Ritu Mehra phone:** `8208998826 ,909` → `8208998826`
2. **Kiran Gavde email:** `@gmali.com` → `@gmail.com`
3. **Subject standardization:** Matched with system subjects
4. **Role clarification:** Proper user_role assignments

### Default Values:

- **Password:** `Staff@123`
- **Department:** `Teaching`
- **User Role:** `teacher` (except principal)
- **Active Status:** `true`

## 📝 Expected Response

### Successful Creation:

```json
{
  "status": "success",
  "message": "Staff member and user account created successfully",
  "data": {
    "staff": {
      "id": "uuid-here",
      "full_name": "Shilpa Anand Lokhande",
      "phone_number": "9558037803",
      "email": "shilpaanandlokhande@gmail.com",
      "role": "teacher",
      "department": "Teaching",
      "designation": "Principal",
      "subject_specialization": "Mathematics, Science",
      "is_active": true
    },
    "user": {
      "id": "uuid-here",
      "full_name": "Shilpa Anand Lokhande",
      "phone_number": "9558037803"
    },
    "login_credentials": {
      "phone_number": "9558037803",
      "password": "Staff@123"
    }
  }
}
```

### If Staff Already Exists:

```json
{
  "status": "error",
  "message": "User with this phone number already exists"
}
```

## 🔍 Verification

### Check Created Staff:

```bash
GET /api/lists/staff
```

### Test Login:

```bash
POST /api/auth/login
{
  "phone_number": "9558037803",
  "password": "Staff@123"
}
```

## ⚠️ Important Notes

### Order of Creation:

1. **Create Principal first** (Shilpa Lokhande) - gets principal role
2. **Create other staff** - all get teacher role
3. **Verify login credentials** work for each

### Duplicate Phone Numbers:

Some staff phone numbers might match parent phone numbers from previous bulk creations. The API will handle this by showing an error for duplicates.

### Subject Assignment:

After creating staff, you can assign specific subjects to teachers using:

```bash
POST /api/academic/teachers/{teacher_id}/subjects
```

## 📋 Manual Creation Checklist

For each of the 24 staff members:

- [ ] Copy payload from `bulk_staff_creation_payloads.json`
- [ ] Make API call to `/api/lists/staff/with-user`
- [ ] Verify successful creation
- [ ] Test login credentials
- [ ] Note any errors for duplicate handling

The staff creation process will establish the complete teaching staff with proper login credentials and subject specializations!
