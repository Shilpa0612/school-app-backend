# Heroku Deployment Fix Guide

## 🚨 Current Issue

Your Heroku app is showing an "Application Error" page. This is likely due to one of the following issues:

## 🔧 Quick Fixes

### 1. **Check Heroku Logs**

```bash
# Install Heroku CLI if not installed
# Windows: Download from https://devcenter.heroku.com/articles/heroku-cli
# Or use: npm install -g heroku

# Login to Heroku
heroku login

# Check your app logs
heroku logs --tail --app your-app-name
```

### 2. **Set Required Environment Variables**

```bash
# Set Supabase configuration
heroku config:set SUPABASE_URL=your_supabase_project_url --app your-app-name
heroku config:set SUPABASE_ANON_KEY=your_supabase_anon_key --app your-app-name
heroku config:set SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key --app your-app-name

# Set JWT secret
heroku config:set JWT_SECRET=your_secure_jwt_secret_key --app your-app-name
heroku config:set JWT_EXPIRES_IN=24h --app your-app-name

# Set other required variables
heroku config:set NODE_ENV=production --app your-app-name
heroku config:set PORT=3000 --app your-app-name
heroku config:set MAX_FILE_SIZE=10485760 --app your-app-name
```

### 3. **Run Database Migrations**

```bash
# Connect to your Heroku database and run migrations
heroku pg:psql --app your-app-name

# In the PostgreSQL console, run:
\i migrations/create_classwork_homework_tables.sql
\i migrations/create_attendance_system.sql
```

### 4. **Restart the Application**

```bash
heroku restart --app your-app-name
```

## 🐛 Common Issues and Solutions

### **Issue 1: Missing Environment Variables**

**Error**: `SUPABASE_URL is not defined`
**Solution**: Set all required environment variables using `heroku config:set`

### **Issue 2: Database Connection Failed**

**Error**: `Connection to database failed`
**Solution**:

- Check if Supabase URL and keys are correct
- Ensure database is accessible from Heroku
- Run database migrations

### **Issue 3: Module Import Errors**

**Error**: `Cannot find module` or `Unexpected token`
**Solution**:

- ✅ **FIXED**: Updated attendance.js to use ES modules
- Ensure all files use consistent import/export syntax

### **Issue 4: Port Binding Issues**

**Error**: `EADDRINUSE` or port conflicts
**Solution**: Heroku automatically sets PORT environment variable

## 🔍 Debugging Steps

### **Step 1: Check Application Status**

```bash
heroku ps --app your-app-name
```

### **Step 2: View Recent Logs**

```bash
heroku logs --app your-app-name --num 100
```

### **Step 3: Test Database Connection**

```bash
# Add this to your index.js temporarily for debugging
app.get('/test-db', async (req, res) => {
    try {
        const { data, error } = await supabase.from('users').select('count').limit(1);
        if (error) throw error;
        res.json({ status: 'success', message: 'Database connection working' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});
```

### **Step 4: Check Environment Variables**

```bash
heroku config --app your-app-name
```

## 📋 Required Environment Variables Checklist

Make sure these are set in Heroku:

- [ ] `SUPABASE_URL`
- [ ] `SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `JWT_SECRET`
- [ ] `JWT_EXPIRES_IN`
- [ ] `NODE_ENV=production`
- [ ] `PORT` (Heroku sets this automatically)
- [ ] `MAX_FILE_SIZE`

## 🚀 Deployment Commands

```bash
# Deploy to Heroku
git add .
git commit -m "Fix ES module syntax and deployment issues"
git push heroku main

# Check deployment status
heroku releases --app your-app-name

# Monitor logs
heroku logs --tail --app your-app-name
```

## 🔧 Manual Database Setup

If you need to manually set up the database:

1. **Create Tables**: Run the migration files in your Supabase SQL editor
2. **Set up RLS**: Ensure Row Level Security is properly configured
3. **Test Connection**: Use the `/test-db` endpoint to verify connectivity

## 📞 Support

If the issue persists:

1. Check Heroku logs for specific error messages
2. Verify all environment variables are set correctly
3. Ensure database migrations have been run
4. Test the application locally first

## ✅ Verification

After fixing, test these endpoints:

- `GET /health` - Should return `{"status": "ok"}`
- `GET /test-db` - Should return database connection success
- Any API endpoint with proper authentication
