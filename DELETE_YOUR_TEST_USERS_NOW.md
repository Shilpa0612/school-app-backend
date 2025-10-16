# 🗑️ Delete Your Test Users - Safe & Easy

## 🚨 You Currently Have These Test Users:

Based on what you showed me, you have **4 test users** to delete:

| ID                                     | Phone      | Name         | Role    |
| -------------------------------------- | ---------- | ------------ | ------- |
| `a5686567-e0df-463d-92ca-aeffffe2fa0d` | 8888888888 | Test Teacher | teacher |
| `970aba6a-e972-47ec-8fab-592520983107` | 7777777777 | Test Parent  | parent  |
| `3a76f089-b1c1-433e-820b-69b587170d50` | 8888620657 | Test Teacher | teacher |
| `ebe2699a-071a-4a56-8dd0-3a45c59da2ae` | 7777620657 | Test Parent  | parent  |

---

## ✅ **Safe Deletion (Copy & Paste)**

### **STEP 1: PREVIEW (Safety Check)**

Copy this into your **Supabase SQL Editor**:

```sql
-- Verify these are test users before deleting
SELECT
    id,
    phone_number,
    full_name,
    email,
    role,
    created_at
FROM users
WHERE id IN (
    'a5686567-e0df-463d-92ca-aeffffe2fa0d',
    '970aba6a-e972-47ec-8fab-592520983107',
    '3a76f089-b1c1-433e-820b-69b587170d50',
    'ebe2699a-071a-4a56-8dd0-3a45c59da2ae'
);
```

**Check:** All should show `full_name = "Test Teacher"` or `"Test Parent"`  
✅ If yes → proceed to Step 2  
❌ If no → STOP! Don't delete!

---

### **STEP 2: DELETE (Only if Step 1 looks good)**

```sql
-- Safe deletion by exact ID
DELETE FROM users
WHERE id IN (
    'a5686567-e0df-463d-92ca-aeffffe2fa0d',
    '970aba6a-e972-47ec-8fab-592520983107',
    '3a76f089-b1c1-433e-820b-69b587170d50',
    'ebe2699a-071a-4a56-8dd0-3a45c59da2ae'
);
```

**This will cascade delete:**

- ✅ The user accounts
- ✅ Any chat threads they created
- ✅ Any messages they sent
- ✅ Read receipts
- ✅ All related data

---

### **STEP 3: VERIFY**

```sql
-- Check deletion was successful
SELECT COUNT(*) as remaining_test_users
FROM users
WHERE full_name IN ('Test Teacher', 'Test Parent')
  AND created_at >= '2025-10-15';
```

**Expected:** `0` (no test users remaining)

---

## 🛡️ **Real Users That Are SAFE**

These are **REAL parents** - they will NOT be deleted:

| Phone      | Name                      | Status  |
| ---------- | ------------------------- | ------- |
| 8888101093 | Dnyaneshwar Namdev Sahane | ✅ Safe |
| 8888779023 | Sambhaji Dattatray Balap  | ✅ Safe |
| 8888138341 | (Real teacher)            | ✅ Safe |

Our deletion uses **exact IDs**, so real users are protected! 🛡️

---

## 💡 **Why This is Safe**

| Method                          | Safety Level  | Why                            |
| ------------------------------- | ------------- | ------------------------------ |
| `WHERE phone LIKE '8888%'`      | ❌ DANGEROUS  | Deletes real parents           |
| `WHERE phone IN ('8888000001')` | ⚠️ SAFE-ish   | Still could match real numbers |
| `WHERE id IN ('exact-id')`      | ✅ **SAFEST** | Only deletes exact users       |

We're using the **safest method**! ✅

---

## 🚀 **Do It Now**

1. Open **Supabase SQL Editor**
2. Copy the **PREVIEW** query from Step 1
3. Run it and verify all are "Test Teacher" or "Test Parent"
4. Copy the **DELETE** query from Step 2
5. Run it
6. Copy the **VERIFY** query from Step 3
7. Should show `0`

Done! ✅

---

## 📝 **Future Testing**

For future tests, the script will now:

- Use unique phone numbers with timestamps
- Show exact IDs for deletion
- Never use dangerous wildcards

See: `SAFE_CLEANUP_GUIDE.md` for more details.

---

## 🎉 **You Just Learned**

✅ Always preview before deleting  
✅ Use exact IDs, not wildcards  
✅ Real data protection matters  
✅ Test data needs careful cleanup

Your production data is safe! 🛡️
