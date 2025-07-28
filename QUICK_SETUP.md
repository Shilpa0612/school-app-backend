# Quick Setup Guide

This is a step-by-step guide to get your School App Backend deployed quickly.

## 🚀 Quick Start (5 minutes)

### 1. GitHub Setup

```bash
# Initialize git and push to GitHub
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/school-app-backend.git
git branch -M main
git push -u origin main
```

### 2. Heroku Setup

```bash
# Login to Heroku
heroku login

# Create app
heroku create your-app-name

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set SUPABASE_URL=your_supabase_url
heroku config:set SUPABASE_ANON_KEY=your_supabase_anon_key
heroku config:set SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
heroku config:set JWT_SECRET=your_jwt_secret
heroku config:set JWT_EXPIRES_IN=24h
heroku config:set MAX_FILE_SIZE=10485760
heroku config:set UPLOAD_PATH=uploads/
heroku config:set LOG_LEVEL=info

# Deploy
git push heroku main
```

### 3. Test Deployment

```bash
# Check if app is running
heroku ps

# Test health endpoint
curl https://your-app-name.herokuapp.com/health

# Open app
heroku open
```

## 📋 Prerequisites Checklist

- [ ] Node.js installed (v16+)
- [ ] Git installed
- [ ] Heroku CLI installed
- [ ] GitHub account
- [ ] Heroku account
- [ ] Supabase project created
- [ ] Database tables set up (run SQL scripts)

## 🔧 Environment Variables Needed

You'll need these values from your Supabase project:

1. **SUPABASE_URL**: Your project URL
2. **SUPABASE_ANON_KEY**: Public anon key
3. **SUPABASE_SERVICE_ROLE_KEY**: Secret service role key
4. **JWT_SECRET**: Any strong secret string

## 🗄️ Database Setup

Run these SQL scripts in your Supabase SQL Editor:

1. `SUPABASE_SETUP_V2.sql` - Main database schema
2. `SETUP_FUNCTION.sql` - Database functions
3. `FIX_HOMEWORK_TABLE.sql` - Homework table fixes

## 🧪 Testing Your API

After deployment, test these endpoints:

```bash
# Health check
curl https://your-app-name.herokuapp.com/health

# Register first admin
curl -X POST https://your-app-name.herokuapp.com/api/system/register-first-admin \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "1234567890",
    "password": "Password123!",
    "full_name": "Admin User",
    "email": "admin@example.com"
  }'
```

## 🆘 Need Help?

1. Check logs: `heroku logs --tail`
2. Verify config: `heroku config`
3. Restart app: `heroku restart`
4. See full guide: `DEPLOYMENT_GUIDE.md`

## 📞 Support

- Heroku logs: `heroku logs --tail`
- GitHub issues: Create issue in your repo
- Documentation: Check `API.md` for endpoint details
