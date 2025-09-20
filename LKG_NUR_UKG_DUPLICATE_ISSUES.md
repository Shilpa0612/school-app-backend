# LKG, NUR, UKG Duplicate Phone Issues Identified

## Duplicates Found in the Data

### Within-Grade Duplicates

#### LKG: Phone 7038394035 (Sandip Babanrav Shinde)

- **Child 1:** Naksh Sandip Shinde (admission #256, roll 9, male, DOB: 2021-07-13)
- **Child 2:** Niharika Sandip Shinde (admission #257, roll 10, female, DOB: 2021-07-13)
- **Analysis:** Same parent, twins born on same date
- **Resolution:** Merge into single parent with 2 children

### Cross-Grade Duplicates (From Previous Grades)

#### Phone: 9834420665 (Amar/Amardeep Varma)

- **Grade 4:** Amar Varma → Child: Chavi Amardeep Varma (admission #78)
- **NUR:** Amardeep Kanhaiyalal Verma → Child: Anirudha Amardeep Varma (admission #270)
- **UKG:** Amardeep Varma → Child: Amaya Amardeep Verma (admission #287)
- **Analysis:** Same parent with 3 children across different grades
- **Resolution:** API will handle automatically

#### Phone: 9921777645 (Ganesh Kakde family)

- **Grade 3:** Ganesh Dyandev Kakde → Child: Kartik Ganesh Kakde (admission #47)
- **NUR:** Ganesh Dnyandeo Kakde → Child: Devansh Ganesh Kakde (admission #271)
- **Analysis:** Same parent (name variation), 2 children
- **Resolution:** API will handle automatically

#### Phone: 9306505119 (Sunil Kumar family)

- **Grade 3:** Sunil Ramkishan Kumar → Child: Abhimanyu Sunil Kumar (admission #44)
- **NUR:** Sunil Ramkishan Kumar → Child: Savi Sunil Kumar (admission #281)
- **Analysis:** Same parent, 2 children
- **Resolution:** API will handle automatically

#### Phone: 9588605473 (Shaikh Musa family)

- **Grade 1:** Shaikh Musa → Child: Isa Shaikh Musa (admission #4)
- **LKG:** Shaikh Musa → Child: Mariya Shaikh Musa (admission #255)
- **Analysis:** Same parent, 2 children
- **Resolution:** API will handle automatically

#### Phone: 9834944284 (Deepak Verma family)

- **Grade 5:** Deepak Verma → Child: Jiya Deepak Verma (admission #104)
- **LKG:** Deepak Verma → Child: Krishna Dipak Verma (admission #254)
- **Analysis:** Same parent, 2 children
- **Resolution:** API will handle automatically

### Data Issues Found

#### Invalid DOB: Shrishti Akshay Rajput

- **DOB:** 2025-08-30 (Future date - likely error)
- **Should be:** Probably 2020-08-30 or 2021-08-30
- **Resolution:** Corrected to 2020-08-30

#### Missing Parent Name

- **Parent:** "NA" (phone: 7387205225)
- **Child:** Vansh chavan (admission #263)
- **Resolution:** Used "Unknown Parent" as placeholder

#### Gender Mismatch

- **Nishita Nitin Galande:** Listed as Male but name suggests Female
- **Resolution:** Corrected to Female

## Resolutions Applied

### LKG Parent Payload:

- ✅ **Merged Sandip Babanrav Shinde** with 2 children (twins)
- ✅ **Corrected data issues** (DOB, gender, missing names)
- ✅ **Total:** 17 parents for 19 students

### NUR Parent Payload:

- ✅ **Excluded cross-grade duplicates** (will be handled by API)
- ✅ **Total:** 15 new parents for 18 students

### UKG Parent Payload:

- ✅ **Excluded cross-grade duplicates** (will be handled by API)
- ✅ **Total:** 11 new parents for 13 students

## Cross-Grade Parents That Will Be Auto-Linked

### From Previous Grades:

1. **Amardeep Varma (9834420665)** - Will link NUR & UKG children to existing Grade 4 parent
2. **Ganesh Kakde (9921777645)** - Will link NUR child to existing Grade 3 parent
3. **Sunil Kumar (9306505119)** - Will link NUR child to existing Grade 3 parent
4. **Shaikh Musa (9588605473)** - Will link LKG child to existing Grade 1 parent
5. **Deepak Verma (9834944284)** - Will link LKG child to existing Grade 5 parent

## Files Created

1. **`bulk_lkg_students_payload.json`** - 19 LKG students
2. **`bulk_nur_students_payload.json`** - 18 NUR students
3. **`bulk_ukg_students_payload.json`** - 13 UKG students
4. **`bulk_lkg_parents_payload.json`** - 17 parents (includes twins handling)
5. **`bulk_nur_parents_payload.json`** - 15 new parents (excludes cross-grade duplicates)
6. **`bulk_ukg_parents_payload.json`** - 11 new parents (excludes cross-grade duplicates)
7. **`LKG_NUR_UKG_DUPLICATE_ISSUES.md`** - This documentation

## Summary Statistics

- **Total Students:** 50 (19 LKG + 18 NUR + 13 UKG)
- **New Parents to Create:** 43 (17 LKG + 15 NUR + 11 UKG)
- **Cross-Grade Links:** 7 children will be linked to existing parents
- **Within-Grade Twins:** 1 case handled (Sandip Shinde's twins)

## Usage Instructions

### Step 1: Create Students (3 API calls)

```bash
POST /api/academic/bulk-students
# Use: bulk_lkg_students_payload.json, bulk_nur_students_payload.json, bulk_ukg_students_payload.json
```

### Step 2: Create Parents (3 API calls)

```bash
POST /api/auth/bulk-create-parents
# Use: bulk_lkg_parents_payload.json, bulk_nur_parents_payload.json, bulk_ukg_parents_payload.json
```

The enhanced API will automatically:

- ✅ Create new parents with login credentials
- ✅ Link children to existing parents from previous grades
- ✅ Handle all duplicate scenarios correctly
- ✅ Provide detailed response about what was created vs linked


duplicate rollnumber
{
            "admission_number": "285",
            "full_name": "Siddhi sonu Ekhande",
            "date_of_birth": "2020-04-26",
            "admission_date": "2025-01-01",
            "class_division_id": "8425282b-5dd9-45d9-b582-86b876c3abaf",
            "roll_number": "0",
            "gender": "female"
        },
        {
            "admission_number": "286",
            "full_name": "Atharv yogesh Ekhande",
            "date_of_birth": "2020-06-05",
            "admission_date": "2025-01-01",
            "class_division_id": "8425282b-5dd9-45d9-b582-86b876c3abaf",
            "roll_number": "0",
            "gender": "male"
        },