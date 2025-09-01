# Teacher Subject Filtering Enhancement

## Overview

The `/api/academic/teachers` endpoint has been enhanced to support **subject name filtering** with intelligent partial matching. This allows users to search for teachers by subject name using various search patterns.

## 🆕 **New Features**

### **1. Subject Filtering**

- Filter teachers by the subjects they teach
- Supports partial matching and abbreviations
- Case-insensitive search

### **2. Enhanced Search**

- General search across all teacher fields
- Subject-based search integration
- Combined filtering capabilities

## 📍 **Endpoint**

```http
GET /api/academic/teachers
```

**Access**: Admin, Principal, Teacher

## 🔍 **Query Parameters**

### **Subject Filter**

```http
GET /api/academic/teachers?subject=math
```

**Examples:**

- `?subject=math` → Finds teachers teaching Mathematics, Maths, etc.
- `?subject=science` → Finds teachers teaching Science
- `?subject=eng` → Finds teachers teaching English

### **General Search**

```http
GET /api/academic/teachers?search=john
```

**Searches across:**

- Teacher name
- Email
- Phone number
- Department
- Designation
- Subjects taught

### **Combined Filtering**

```http
GET /api/academic/teachers?subject=math&search=john
```

**Combines both filters** for precise results.

## 🎯 **Subject Matching Logic**

### **1. Exact Match**

- `subject=Mathematics` → Finds teachers teaching "Mathematics"

### **2. Partial Match**

- `subject=math` → Finds teachers teaching "Mathematics", "Maths"
- `subject=sci` → Finds teachers teaching "Science"

### **3. Common Abbreviations**

The system recognizes common subject abbreviations:

| Search Term | Matches                |
| ----------- | ---------------------- |
| `math`      | Mathematics, Maths     |
| `sci`       | Science                |
| `eng`       | English                |
| `hindi`     | Hindi                  |
| `kan`       | Kannada                |
| `soc`       | Social Studies, Social |
| `hist`      | History                |
| `geo`       | Geography              |
| `phy`       | Physics                |
| `chem`      | Chemistry              |
| `bio`       | Biology                |

### **4. Reverse Matching**

- `subject=Mathematics` → Also matches if searching for "math"

## 📊 **Response Format**

### **Success Response**

```json
{
  "status": "success",
  "data": {
    "teachers": [
      {
        "teacher_id": "uuid",
        "user_id": "uuid",
        "staff_id": "uuid",
        "full_name": "Teacher Name",
        "phone_number": "+1234567890",
        "email": "teacher@school.com",
        "department": "Mathematics",
        "designation": "Senior Teacher",
        "is_active": true,
        "subjects_taught": ["Mathematics", "Physics"]
      }
    ],
    "total": 1,
    "message": "Use teacher_id for class division assignments",
    "filters_applied": {
      "subject": "math",
      "search": null
    }
  }
}
```

### **New Fields**

- **`subjects_taught`**: Array of subjects the teacher is assigned to teach
- **`filters_applied`**: Shows which filters were applied to the results

## 🚀 **Usage Examples**

### **Example 1: Find Math Teachers**

```http
GET /api/academic/teachers?subject=math
```

**Result**: Returns all teachers teaching Mathematics, Maths, or related subjects.

### **Example 2: Find Science Teachers Named John**

```http
GET /api/academic/teachers?subject=science&search=john
```

**Result**: Returns teachers named John who teach Science.

### **Example 3: Find All English Teachers**

```http
GET /api/academic/teachers?subject=eng
```

**Result**: Returns all teachers teaching English.

### **Example 4: General Teacher Search**

```http
GET /api/academic/teachers?search=senior
```

**Result**: Returns teachers with "senior" in their name, department, designation, or subjects.

## 🔧 **Technical Implementation**

### **Database Queries**

1. **Primary Query**: Fetches all teachers from `users` table
2. **Staff Query**: Fetches staff information for teachers
3. **Subject Query**: Fetches teacher assignments with subjects (only when filtering by subject)

### **Filtering Logic**

1. **Subject Filter**: Applies intelligent subject matching
2. **Search Filter**: Searches across all teacher fields
3. **Combined Filtering**: Applies both filters sequentially

### **Performance Optimizations**

- Subject assignments are only fetched when subject filtering is requested
- Efficient array filtering and mapping
- Minimal database queries

## 🎉 **Benefits**

1. **Easy Teacher Discovery**: Find teachers by subject quickly
2. **Flexible Search**: Multiple search patterns supported
3. **User-Friendly**: Common abbreviations work automatically
4. **Comprehensive Results**: Shows all subjects a teacher teaches
5. **Performance**: Efficient filtering without unnecessary queries

## 🔍 **Testing the Feature**

### **Test Cases**

1. **Exact Subject Match**: `?subject=Mathematics`
2. **Partial Match**: `?subject=math`
3. **Abbreviation**: `?subject=sci`
4. **General Search**: `?search=john`
5. **Combined Filters**: `?subject=math&search=senior`

### **Expected Results**

- Math teachers should appear when searching for "math"
- Science teachers should appear when searching for "sci"
- Combined filters should return intersection of results
- All searches should be case-insensitive

## 📝 **Notes**

- **Subject filtering** only works for teachers with active subject assignments
- **General search** works across all teacher data
- **Combined filtering** provides precise results
- **Performance** is optimized for typical use cases
- **Backward compatibility** is maintained

This enhancement makes it much easier to find teachers by subject, supporting both exact and partial matching with intelligent abbreviation recognition.
