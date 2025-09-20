# Bulk Staff Creation Guide

## ✅ NEW BULK ENDPOINT CREATED!

I've created a new bulk staff creation endpoint that allows you to create all 24 staff members in **one API call**!

## 🚀 Bulk Staff Creation

### **NEW Endpoint:** `POST /api/lists/staff/bulk-with-user`

**Headers:**

```
Content-Type: application/json
Authorization: Bearer <your-auth-token>
```

**Payload:** Use the contents of `bulk_staff_with_user_payload.json`

**cURL Example:**

```bash
curl -X POST https://ajws-school-ba8ae5e3f955.herokuapp.com/api/lists/staff/bulk-with-user \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d @bulk_staff_with_user_payload.json
```

## 📁 Files for Bulk Creation

1. **`bulk_staff_with_user_payload.json`** - Single payload for all 24 staff members
2. **`BULK_STAFF_CREATION_GUIDE.md`** - This instruction guide

## 🎯 Features of the New Bulk Endpoint

### Smart Duplicate Handling:

- ✅ **Detects existing staff** by phone number
- ✅ **Creates only new staff** (skips duplicates)
- ✅ **No errors** for existing phone numbers
- ✅ **Detailed response** showing created vs skipped

### Automatic User Account Creation:

- ✅ **Creates user accounts** for login
- ✅ **Sets proper roles** (principal vs teacher)
- ✅ **Hashes passwords** securely
- ✅ **Links staff to user accounts**

### Data Validation:

- ✅ **Required fields** validation
- ✅ **Phone number** format checking
- ✅ **Role validation** (admin/principal/teacher)
- ✅ **Batch size limits** (max 50 staff)

## 📊 Staff Data Summary

### 24 Staff Members with Login Credentials:

- **1 Principal** (Shilpa Lokhande - gets `user_role: "principal"`)
- **23 Teachers** (all get `user_role: "teacher"`)

### All Staff Login Credentials:

- **Phone Number:** Individual numbers from data
- **Password:** `Temp@1234` (consistent with parents)

### Data Corrections Applied:

- ✅ **Ritu Mehra phone:** Fixed invalid format
- ✅ **Kiran Gavde email:** Fixed typo (@gmali → @gmail)
- ✅ **Subject specializations:** Standardized format

## 📈 Expected Response

### Successful Bulk Creation:

```json
{
  "status": "success",
  "message": "Bulk staff creation completed: 24 created, 0 skipped, 0 errors",
  "data": {
    "created_staff": {
      "count": 24,
      "staff": [
        {
          "staff": {
            "id": "uuid-here",
            "full_name": "Shilpa Anand Lokhande",
            "phone_number": "9558037803",
            "designation": "Principal",
            "subject": ["Mathematics", "Science"]
          },
          "user": {
            "id": "uuid-here",
            "phone_number": "9558037803",
            "role": "principal"
          },
          "login_credentials": {
            "phone_number": "9558037803",
            "password": "Temp@1234"
          }
        },
        ...
      ]
    },
    "summary": {
      "total_processed": 24,
      "successful": 24,
      "skipped": 0,
      "failed": 0
    }
  }
}
```

### If Some Staff Already Exist:

```json
{
  "status": "success",
  "message": "Bulk staff creation completed: 20 created, 4 skipped, 0 errors",
  "data": {
    "created_staff": { "count": 20, "staff": [...] },
    "skipped_staff": {
      "count": 4,
      "staff": [
        {
          "full_name": "Rohit Sharma",
          "phone_number": "9673071555",
          "reason": "Phone number already exists"
        }
      ]
    }
  }
}
```

## 🔧 How the Bulk Endpoint Works

### Process Flow:

1. **Validates** all staff data in the batch
2. **Checks for duplicates** within the batch
3. **Identifies existing** staff by phone number
4. **Creates new staff only** (skips existing)
5. **Creates user accounts** for each new staff
6. **Links staff records** to user accounts
7. **Returns comprehensive results**

### Error Handling:

- **Individual errors** don't stop the entire batch
- **Rollback protection** (if staff creation fails, user account is deleted)
- **Detailed error reporting** for each failed staff member

## 🎯 Usage Comparison

### Before (Individual Calls):

❌ 24 separate API calls required
❌ Manual duplicate handling
❌ Time-consuming process
❌ Complex error management

### After (Bulk Endpoint):

✅ **Single API call** for all 24 staff
✅ **Automatic duplicate handling**
✅ **Fast batch processing**
✅ **Comprehensive error reporting**

## 🔑 Login Testing

After bulk creation, test staff login:

### Principal Login:

```bash
POST /api/auth/login
{
  "phone_number": "9558037803",
  "password": "Temp@1234"
}
```

### Teacher Login:

```bash
POST /api/auth/login
{
  "phone_number": "9881196073",
  "password": "Temp@1234"
}
```

## ⚠️ Important Notes

### Potential Duplicates:

Some staff phone numbers might match existing parent/student phone numbers:

- **Rohit Sharma (9673071555)** - Appears in parent data for Grades 4 & 5
- **Nitin Lalchand Bhakt (9881743999)** - Appears in parent data for UKG
- **Shivaji Umaji Gavate (7972381699)** - Appears in parent data for UKG

The bulk endpoint will **skip these duplicates** and report them in the response.

### Role Assignment:

- **Shilpa Lokhande** gets `user_role: "principal"` (can access admin functions)
- **All others** get `user_role: "teacher"` (standard teacher permissions)

## 🎉 Ready to Use!

You can now create all 24 staff members with **one API call** using the `bulk_staff_with_user_payload.json` file. The new bulk endpoint handles all the complexity automatically!



{
    "status": "success",
    "message": "Bulk staff creation completed: 19 created, 4 skipped, 0 errors",
    "data": {
        "created_staff": {
            "count": 19,
            "staff": [
                {
                    "staff": {
                        "id": "08b102be-54ff-4a96-944e-23192385a76f",
                        "full_name": "Sandesh Ingle",
                        "phone_number": "9881196073",
                        "email": "inglesandesh128@gmail.com",
                        "role": "teacher",
                        "subject": "[\"Mathematics\",\"Physics\"]",
                        "department": "Teaching",
                        "designation": "Coordinator",
                        "joining_date": null,
                        "address": null,
                        "emergency_contact": null,
                        "emergency_contact_phone": null,
                        "is_active": true,
                        "created_by": "b9a49f00-a5ad-4824-852f-7ba46d5f09a6",
                        "created_at": "2025-09-19T23:33:56.837557+00:00",
                        "updated_at": "2025-09-19T23:33:56.837557+00:00",
                        "user_id": "b4dd99d1-c905-4f42-9693-b677b1dddd4b",
                        "date_of_birth": null
                    },
                    "user": {
                        "id": "b4dd99d1-c905-4f42-9693-b677b1dddd4b",
                        "full_name": "Sandesh Ingle",
                        "phone_number": "9881196073",
                        "email": "inglesandesh128@gmail.com",
                        "role": "teacher"
                    },
                    "login_credentials": {
                        "phone_number": "9881196073",
                        "password": "Temp@1234"
                    }
                },
                {
                    "staff": {
                        "id": "5718ed36-7ed8-4ba1-a0ae-2afa339f1c56",
                        "full_name": "Shakuntala Prasad Patil",
                        "phone_number": "9922799868",
                        "email": "shakuntalapatilajws@gmail.com",
                        "role": "teacher",
                        "subject": "[\"Marathi\"]",
                        "department": "Teaching",
                        "designation": "Librarian",
                        "joining_date": null,
                        "address": null,
                        "emergency_contact": null,
                        "emergency_contact_phone": null,
                        "is_active": true,
                        "created_by": "b9a49f00-a5ad-4824-852f-7ba46d5f09a6",
                        "created_at": "2025-09-19T23:33:57.279279+00:00",
                        "updated_at": "2025-09-19T23:33:57.279279+00:00",
                        "user_id": "6f654a3c-1ba3-4182-9b9c-78bcfe31f237",
                        "date_of_birth": null
                    },
                    "user": {
                        "id": "6f654a3c-1ba3-4182-9b9c-78bcfe31f237",
                        "full_name": "Shakuntala Prasad Patil",
                        "phone_number": "9922799868",
                        "email": "shakuntalapatilajws@gmail.com",
                        "role": "teacher"
                    },
                    "login_credentials": {
                        "phone_number": "9922799868",
                        "password": "Temp@1234"
                    }
                },
                {
                    "staff": {
                        "id": "657a5ec6-3bc8-4164-844b-bbaa841c5761",
                        "full_name": "Anjali Shivaji Hiwrale",
                        "phone_number": "7058832430",
                        "email": "anjalihiwrale789@gmail.com",
                        "role": "teacher",
                        "subject": "[\"Mathematics\",\"Science\",\"English\"]",
                        "department": "Teaching",
                        "designation": "NTT",
                        "joining_date": null,
                        "address": null,
                        "emergency_contact": null,
                        "emergency_contact_phone": null,
                        "is_active": true,
                        "created_by": "b9a49f00-a5ad-4824-852f-7ba46d5f09a6",
                        "created_at": "2025-09-19T23:33:57.512763+00:00",
                        "updated_at": "2025-09-19T23:33:57.512763+00:00",
                        "user_id": "ce9904f0-b4b3-45dd-9a92-4dc9d0c9187e",
                        "date_of_birth": null
                    },
                    "user": {
                        "id": "ce9904f0-b4b3-45dd-9a92-4dc9d0c9187e",
                        "full_name": "Anjali Shivaji Hiwrale",
                        "phone_number": "7058832430",
                        "email": "anjalihiwrale789@gmail.com",
                        "role": "teacher"
                    },
                    "login_credentials": {
                        "phone_number": "7058832430",
                        "password": "Temp@1234"
                    }
                },
                {
                    "staff": {
                        "id": "b25e6fb4-014b-471b-9aaf-cf1d8ad180e4",
                        "full_name": "Beena Satish Arya",
                        "phone_number": "8830289326",
                        "email": "satisharya302@gmail.com",
                        "role": "teacher",
                        "subject": "[\"Hindi\",\"Marathi\",\"English\"]",
                        "department": "Teaching",
                        "designation": "NTT",
                        "joining_date": null,
                        "address": null,
                        "emergency_contact": null,
                        "emergency_contact_phone": null,
                        "is_active": true,
                        "created_by": "b9a49f00-a5ad-4824-852f-7ba46d5f09a6",
                        "created_at": "2025-09-19T23:33:57.748858+00:00",
                        "updated_at": "2025-09-19T23:33:57.748858+00:00",
                        "user_id": "06470cb6-a3a0-429e-ad2e-438d52bfb0f2",
                        "date_of_birth": null
                    },
                    "user": {
                        "id": "06470cb6-a3a0-429e-ad2e-438d52bfb0f2",
                        "full_name": "Beena Satish Arya",
                        "phone_number": "8830289326",
                        "email": "satisharya302@gmail.com",
                        "role": "teacher"
                    },
                    "login_credentials": {
                        "phone_number": "8830289326",
                        "password": "Temp@1234"
                    }
                },
                {
                    "staff": {
                        "id": "cd97234a-0a5e-4ca4-bc10-4e99b102423c",
                        "full_name": "Varsha Sachin Mhaske",
                        "phone_number": "9405068400",
                        "email": "vsmhaske2544@Gmail.com",
                        "role": "teacher",
                        "subject": "[\"English\",\"Hindi\",\"Marathi\",\"Environmental Science\"]",
                        "department": "Teaching",
                        "designation": "NTT",
                        "joining_date": null,
                        "address": null,
                        "emergency_contact": null,
                        "emergency_contact_phone": null,
                        "is_active": true,
                        "created_by": "b9a49f00-a5ad-4824-852f-7ba46d5f09a6",
                        "created_at": "2025-09-19T23:33:57.971147+00:00",
                        "updated_at": "2025-09-19T23:33:57.971147+00:00",
                        "user_id": "17100888-e365-4450-867a-2bdf1564426e",
                        "date_of_birth": null
                    },
                    "user": {
                        "id": "17100888-e365-4450-867a-2bdf1564426e",
                        "full_name": "Varsha Sachin Mhaske",
                        "phone_number": "9405068400",
                        "email": "vsmhaske2544@Gmail.com",
                        "role": "teacher"
                    },
                    "login_credentials": {
                        "phone_number": "9405068400",
                        "password": "Temp@1234"
                    }
                },
                {
                    "staff": {
                        "id": "8f54461a-3b63-450e-9760-bb7419440808",
                        "full_name": "Ganesh Madhukar Dabhade",
                        "phone_number": "9404511717",
                        "email": "ganeshdabhade1818@gmail.com",
                        "role": "teacher",
                        "subject": "[\"Physical Education\"]",
                        "department": "Teaching",
                        "designation": "PET",
                        "joining_date": null,
                        "address": null,
                        "emergency_contact": null,
                        "emergency_contact_phone": null,
                        "is_active": true,
                        "created_by": "b9a49f00-a5ad-4824-852f-7ba46d5f09a6",
                        "created_at": "2025-09-19T23:33:58.184803+00:00",
                        "updated_at": "2025-09-19T23:33:58.184803+00:00",
                        "user_id": "5c04a839-1f30-4359-8650-f2e90a0545a3",
                        "date_of_birth": null
                    },
                    "user": {
                        "id": "5c04a839-1f30-4359-8650-f2e90a0545a3",
                        "full_name": "Ganesh Madhukar Dabhade",
                        "phone_number": "9404511717",
                        "email": "ganeshdabhade1818@gmail.com",
                        "role": "teacher"
                    },
                    "login_credentials": {
                        "phone_number": "9404511717",
                        "password": "Temp@1234"
                    }
                },
                {
                    "staff": {
                        "id": "c8031751-c926-4262-8829-8f482123ade1",
                        "full_name": "Kiran Gavde",
                        "phone_number": "7057570407",
                        "email": "kirangavde1110@gmail.com",
                        "role": "teacher",
                        "subject": "[\"Physical Education\"]",
                        "department": "Teaching",
                        "designation": "PET",
                        "joining_date": null,
                        "address": null,
                        "emergency_contact": null,
                        "emergency_contact_phone": null,
                        "is_active": true,
                        "created_by": "b9a49f00-a5ad-4824-852f-7ba46d5f09a6",
                        "created_at": "2025-09-19T23:33:58.399514+00:00",
                        "updated_at": "2025-09-19T23:33:58.399514+00:00",
                        "user_id": "5e7a0ad9-ad40-426f-9433-369579436790",
                        "date_of_birth": null
                    },
                    "user": {
                        "id": "5e7a0ad9-ad40-426f-9433-369579436790",
                        "full_name": "Kiran Gavde",
                        "phone_number": "7057570407",
                        "email": "kirangavde1110@gmail.com",
                        "role": "teacher"
                    },
                    "login_credentials": {
                        "phone_number": "7057570407",
                        "password": "Temp@1234"
                    }
                },
                {
                    "staff": {
                        "id": "a728aaaf-3e17-4470-b30b-b1fa654780fc",
                        "full_name": "Omkar Sanjay Raut",
                        "phone_number": "9158834913",
                        "email": "omraut449@gmail.com",
                        "role": "teacher",
                        "subject": "[\"Cricket\",\"Sports\"]",
                        "department": "Teaching",
                        "designation": "PET",
                        "joining_date": null,
                        "address": null,
                        "emergency_contact": null,
                        "emergency_contact_phone": null,
                        "is_active": true,
                        "created_by": "b9a49f00-a5ad-4824-852f-7ba46d5f09a6",
                        "created_at": "2025-09-19T23:33:58.627398+00:00",
                        "updated_at": "2025-09-19T23:33:58.627398+00:00",
                        "user_id": "b6f9c547-3d84-4907-b5c6-d5c8f4556fdf",
                        "date_of_birth": null
                    },
                    "user": {
                        "id": "b6f9c547-3d84-4907-b5c6-d5c8f4556fdf",
                        "full_name": "Omkar Sanjay Raut",
                        "phone_number": "9158834913",
                        "email": "omraut449@gmail.com",
                        "role": "teacher"
                    },
                    "login_credentials": {
                        "phone_number": "9158834913",
                        "password": "Temp@1234"
                    }
                },
                {
                    "staff": {
                        "id": "85d5f413-655d-4fa9-bfe5-3ae4ae1adaf6",
                        "full_name": "Khushbu Rohit Sharma",
                        "phone_number": "9529016275",
                        "email": "khushbusharma0930@gmail.com",
                        "role": "teacher",
                        "subject": "[\"English\"]",
                        "department": "Teaching",
                        "designation": "PRT",
                        "joining_date": null,
                        "address": null,
                        "emergency_contact": null,
                        "emergency_contact_phone": null,
                        "is_active": true,
                        "created_by": "b9a49f00-a5ad-4824-852f-7ba46d5f09a6",
                        "created_at": "2025-09-19T23:33:58.848111+00:00",
                        "updated_at": "2025-09-19T23:33:58.848111+00:00",
                        "user_id": "67b8a63e-60e1-450b-835a-c717001708cd",
                        "date_of_birth": null
                    },
                    "user": {
                        "id": "67b8a63e-60e1-450b-835a-c717001708cd",
                        "full_name": "Khushbu Rohit Sharma",
                        "phone_number": "9529016275",
                        "email": "khushbusharma0930@gmail.com",
                        "role": "teacher"
                    },
                    "login_credentials": {
                        "phone_number": "9529016275",
                        "password": "Temp@1234"
                    }
                },
                {
                    "staff": {
                        "id": "7769fae3-5716-4498-bcd4-d84c746fb979",
                        "full_name": "Neha Chandanlal Kaushalye",
                        "phone_number": "9307915550",
                        "email": "kaushalyeneha27.ajws@gmail.com",
                        "role": "teacher",
                        "subject": "[\"Mathematics\"]",
                        "department": "Teaching",
                        "designation": "PRT",
                        "joining_date": null,
                        "address": null,
                        "emergency_contact": null,
                        "emergency_contact_phone": null,
                        "is_active": true,
                        "created_by": "b9a49f00-a5ad-4824-852f-7ba46d5f09a6",
                        "created_at": "2025-09-19T23:33:59.080011+00:00",
                        "updated_at": "2025-09-19T23:33:59.080011+00:00",
                        "user_id": "f539bbe1-86a3-4379-86a6-2d6c2429d6ad",
                        "date_of_birth": null
                    },
                    "user": {
                        "id": "f539bbe1-86a3-4379-86a6-2d6c2429d6ad",
                        "full_name": "Neha Chandanlal Kaushalye",
                        "phone_number": "9307915550",
                        "email": "kaushalyeneha27.ajws@gmail.com",
                        "role": "teacher"
                    },
                    "login_credentials": {
                        "phone_number": "9307915550",
                        "password": "Temp@1234"
                    }
                },
                {
                    "staff": {
                        "id": "ae8bd6e6-65d5-4819-83e5-0a9f49b15b49",
                        "full_name": "Rajeshri Mahesh Kodam",
                        "phone_number": "8554005134",
                        "email": "rajeshrigudur305@gmail.com",
                        "role": "teacher",
                        "subject": "[\"Hindi\"]",
                        "department": "Teaching",
                        "designation": "PRT",
                        "joining_date": null,
                        "address": null,
                        "emergency_contact": null,
                        "emergency_contact_phone": null,
                        "is_active": true,
                        "created_by": "b9a49f00-a5ad-4824-852f-7ba46d5f09a6",
                        "created_at": "2025-09-19T23:33:59.272389+00:00",
                        "updated_at": "2025-09-19T23:33:59.272389+00:00",
                        "user_id": "d8fbf574-9d4b-443d-adf7-6767bb6cd363",
                        "date_of_birth": null
                    },
                    "user": {
                        "id": "d8fbf574-9d4b-443d-adf7-6767bb6cd363",
                        "full_name": "Rajeshri Mahesh Kodam",
                        "phone_number": "8554005134",
                        "email": "rajeshrigudur305@gmail.com",
                        "role": "teacher"
                    },
                    "login_credentials": {
                        "phone_number": "8554005134",
                        "password": "Temp@1234"
                    }
                },
                {
                    "staff": {
                        "id": "5ae8086b-20aa-425c-899e-1a81949b479d",
                        "full_name": "Ritu Mehra",
                        "phone_number": "8208998826",
                        "email": "ritumehra529@gmail.com",
                        "role": "teacher",
                        "subject": "[\"English\",\"Mathematics\",\"Environmental Science\",\"Social Studies\"]",
                        "department": "Teaching",
                        "designation": "PRT",
                        "joining_date": null,
                        "address": null,
                        "emergency_contact": null,
                        "emergency_contact_phone": null,
                        "is_active": true,
                        "created_by": "b9a49f00-a5ad-4824-852f-7ba46d5f09a6",
                        "created_at": "2025-09-19T23:33:59.486411+00:00",
                        "updated_at": "2025-09-19T23:33:59.486411+00:00",
                        "user_id": "e0fd144b-8cb7-4f99-9a49-7cb07e69a453",
                        "date_of_birth": null
                    },
                    "user": {
                        "id": "e0fd144b-8cb7-4f99-9a49-7cb07e69a453",
                        "full_name": "Ritu Mehra",
                        "phone_number": "8208998826",
                        "email": "ritumehra529@gmail.com",
                        "role": "teacher"
                    },
                    "login_credentials": {
                        "phone_number": "8208998826",
                        "password": "Temp@1234"
                    }
                },
                {
                    "staff": {
                        "id": "9bfe85c0-e89d-49ae-9bbf-08ce0843ed63",
                        "full_name": "Rohini Sakharam Sable",
                        "phone_number": "9665009033",
                        "email": "rsable286@gmail.com",
                        "role": "teacher",
                        "subject": "[\"Environmental Science\"]",
                        "department": "Teaching",
                        "designation": "PRT",
                        "joining_date": null,
                        "address": null,
                        "emergency_contact": null,
                        "emergency_contact_phone": null,
                        "is_active": true,
                        "created_by": "b9a49f00-a5ad-4824-852f-7ba46d5f09a6",
                        "created_at": "2025-09-19T23:33:59.663978+00:00",
                        "updated_at": "2025-09-19T23:33:59.663978+00:00",
                        "user_id": "7b7eb9b9-dfab-4779-89db-9a19c1d9aa6c",
                        "date_of_birth": null
                    },
                    "user": {
                        "id": "7b7eb9b9-dfab-4779-89db-9a19c1d9aa6c",
                        "full_name": "Rohini Sakharam Sable",
                        "phone_number": "9665009033",
                        "email": "rsable286@gmail.com",
                        "role": "teacher"
                    },
                    "login_credentials": {
                        "phone_number": "9665009033",
                        "password": "Temp@1234"
                    }
                },
                {
                    "staff": {
                        "id": "63ec2b20-0546-42af-b125-7c92b28d914a",
                        "full_name": "Vaishali Kiran Harne",
                        "phone_number": "8010858248",
                        "email": "Vaishaliharne1982@gmail.com",
                        "role": "teacher",
                        "subject": "[\"Marathi\"]",
                        "department": "Teaching",
                        "designation": "PRT",
                        "joining_date": null,
                        "address": null,
                        "emergency_contact": null,
                        "emergency_contact_phone": null,
                        "is_active": true,
                        "created_by": "b9a49f00-a5ad-4824-852f-7ba46d5f09a6",
                        "created_at": "2025-09-19T23:33:59.862562+00:00",
                        "updated_at": "2025-09-19T23:33:59.862562+00:00",
                        "user_id": "3b65ef1f-2488-4531-96d1-6ac4b048b588",
                        "date_of_birth": null
                    },
                    "user": {
                        "id": "3b65ef1f-2488-4531-96d1-6ac4b048b588",
                        "full_name": "Vaishali Kiran Harne",
                        "phone_number": "8010858248",
                        "email": "Vaishaliharne1982@gmail.com",
                        "role": "teacher"
                    },
                    "login_credentials": {
                        "phone_number": "8010858248",
                        "password": "Temp@1234"
                    }
                },
                {
                    "staff": {
                        "id": "e37ffcc8-c080-442f-a0bd-617278d9566e",
                        "full_name": "Vijayata Kamarushi",
                        "phone_number": "9405913477",
                        "email": "vijayatarao25@gmail.com",
                        "role": "teacher",
                        "subject": "[\"English\"]",
                        "department": "Teaching",
                        "designation": "PRT",
                        "joining_date": null,
                        "address": null,
                        "emergency_contact": null,
                        "emergency_contact_phone": null,
                        "is_active": true,
                        "created_by": "b9a49f00-a5ad-4824-852f-7ba46d5f09a6",
                        "created_at": "2025-09-19T23:34:00.116791+00:00",
                        "updated_at": "2025-09-19T23:34:00.116791+00:00",
                        "user_id": "59b683ab-1b19-4ea0-ac7d-bda1805cbefa",
                        "date_of_birth": null
                    },
                    "user": {
                        "id": "59b683ab-1b19-4ea0-ac7d-bda1805cbefa",
                        "full_name": "Vijayata Kamarushi",
                        "phone_number": "9405913477",
                        "email": "vijayatarao25@gmail.com",
                        "role": "teacher"
                    },
                    "login_credentials": {
                        "phone_number": "9405913477",
                        "password": "Temp@1234"
                    }
                },
                {
                    "staff": {
                        "id": "c3fdf84c-3396-43d2-a13e-93db78c79e40",
                        "full_name": "Kalpak Anil Tiwari",
                        "phone_number": "9405913883",
                        "email": "tiwarikalpak@gmail.com",
                        "role": "teacher",
                        "subject": "[\"English\",\"Biology\",\"Social Studies\"]",
                        "department": "Teaching",
                        "designation": "TGT",
                        "joining_date": null,
                        "address": null,
                        "emergency_contact": null,
                        "emergency_contact_phone": null,
                        "is_active": true,
                        "created_by": "b9a49f00-a5ad-4824-852f-7ba46d5f09a6",
                        "created_at": "2025-09-19T23:34:00.306968+00:00",
                        "updated_at": "2025-09-19T23:34:00.306968+00:00",
                        "user_id": "b6f8e249-9b40-4570-abb0-fe9592415189",
                        "date_of_birth": null
                    },
                    "user": {
                        "id": "b6f8e249-9b40-4570-abb0-fe9592415189",
                        "full_name": "Kalpak Anil Tiwari",
                        "phone_number": "9405913883",
                        "email": "tiwarikalpak@gmail.com",
                        "role": "teacher"
                    },
                    "login_credentials": {
                        "phone_number": "9405913883",
                        "password": "Temp@1234"
                    }
                },
                {
                    "staff": {
                        "id": "e41599f4-b72c-40ef-bb06-d9b8936932a2",
                        "full_name": "Kishor Lokhande",
                        "phone_number": "9822109314",
                        "email": "kishorlokhande2121@gmail.com",
                        "role": "teacher",
                        "subject": "[\"Art and Craft\"]",
                        "department": "Teaching",
                        "designation": "TGT",
                        "joining_date": null,
                        "address": null,
                        "emergency_contact": null,
                        "emergency_contact_phone": null,
                        "is_active": true,
                        "created_by": "b9a49f00-a5ad-4824-852f-7ba46d5f09a6",
                        "created_at": "2025-09-19T23:34:00.963368+00:00",
                        "updated_at": "2025-09-19T23:34:00.963368+00:00",
                        "user_id": "f58164da-8773-4f18-b111-7ed31e9841f6",
                        "date_of_birth": null
                    },
                    "user": {
                        "id": "f58164da-8773-4f18-b111-7ed31e9841f6",
                        "full_name": "Kishor Lokhande",
                        "phone_number": "9822109314",
                        "email": "kishorlokhande2121@gmail.com",
                        "role": "teacher"
                    },
                    "login_credentials": {
                        "phone_number": "9822109314",
                        "password": "Temp@1234"
                    }
                },
                {
                    "staff": {
                        "id": "b0d4f020-adbd-481b-bae4-c9c13e78465a",
                        "full_name": "Pranjal Khandelwal",
                        "phone_number": "9421319018",
                        "email": "pranjal.a.khandelwal@gmail.com",
                        "role": "teacher",
                        "subject": "[\"Biology\"]",
                        "department": "Teaching",
                        "designation": "TGT",
                        "joining_date": null,
                        "address": null,
                        "emergency_contact": null,
                        "emergency_contact_phone": null,
                        "is_active": true,
                        "created_by": "b9a49f00-a5ad-4824-852f-7ba46d5f09a6",
                        "created_at": "2025-09-19T23:34:01.150853+00:00",
                        "updated_at": "2025-09-19T23:34:01.150853+00:00",
                        "user_id": "e35ddc27-5de3-4de8-af6f-2e2d75a3a407",
                        "date_of_birth": null
                    },
                    "user": {
                        "id": "e35ddc27-5de3-4de8-af6f-2e2d75a3a407",
                        "full_name": "Pranjal Khandelwal",
                        "phone_number": "9421319018",
                        "email": "pranjal.a.khandelwal@gmail.com",
                        "role": "teacher"
                    },
                    "login_credentials": {
                        "phone_number": "9421319018",
                        "password": "Temp@1234"
                    }
                },
                {
                    "staff": {
                        "id": "4e7a5e23-9197-48e9-9c5f-da4ea073c429",
                        "full_name": "Sandip Sukhadeo Madankar",
                        "phone_number": "9309803752",
                        "email": "sandipmad5@gmail.com",
                        "role": "teacher",
                        "subject": "[\"Music\"]",
                        "department": "Teaching",
                        "designation": "TGT",
                        "joining_date": null,
                        "address": null,
                        "emergency_contact": null,
                        "emergency_contact_phone": null,
                        "is_active": true,
                        "created_by": "b9a49f00-a5ad-4824-852f-7ba46d5f09a6",
                        "created_at": "2025-09-19T23:34:01.344015+00:00",
                        "updated_at": "2025-09-19T23:34:01.344015+00:00",
                        "user_id": "d5d0883a-ab74-4f36-9f1d-5a65e5db57fe",
                        "date_of_birth": null
                    },
                    "user": {
                        "id": "d5d0883a-ab74-4f36-9f1d-5a65e5db57fe",
                        "full_name": "Sandip Sukhadeo Madankar",
                        "phone_number": "9309803752",
                        "email": "sandipmad5@gmail.com",
                        "role": "teacher"
                    },
                    "login_credentials": {
                        "phone_number": "9309803752",
                        "password": "Temp@1234"
                    }
                }
            ]
        },
        "skipped_staff": {
            "count": 4,
            "staff": [
                {
                    "full_name": "Diksha sandesh ingle",
                    "phone_number": "9309478094",
                    "reason": "Phone number already exists"
                },
                {
                    "full_name": "Nitin Lalchand Bhakt",
                    "phone_number": "9881743999",
                    "reason": "Phone number already exists"
                },
                {
                    "full_name": "Rohit Sharma",
                    "phone_number": "9673071555",
                    "reason": "Phone number already exists"
                },
                {
                    "full_name": "Shivaji Umaji Gavate",
                    "phone_number": "7972381699",
                    "reason": "Phone number already exists"
                }
            ]
        },
        "errors": {
            "count": 0,
            "details": []
        },
        "summary": {
            "total_processed": 23,
            "successful": 19,
            "skipped": 4,
            "failed": 0
        }
    }
}