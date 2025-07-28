# Deployment Guide

This guide will help you deploy your School App Backend to both GitHub and Heroku.

## Prerequisites

Before starting, make sure you have:

- [Node.js](https://nodejs.org/) (v16 or higher)
- [Git](https://git-scm.com/) installed
- [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli) installed
- A [GitHub](https://github.com) account
- A [Heroku](https://heroku.com) account
- A [Supabase](https://supabase.com) project

## Step 1: GitHub Setup

### 1.1 Initialize Git Repository

```bash
# Initialize git repository (if not already done)
git init

# Add all files
git add .

# Make initial commit
git commit -m "Initial commit: School App Backend"
```

### 1.2 Create GitHub Repository

1. Go to [GitHub](https://github.com)
2. Click the "+" icon in the top right corner
3. Select "New repository"
4. Name it `school-app-backend`
5. Make it public or private (your choice)
6. **Don't** initialize with README (we already have one)
7. Click "Create repository"

### 1.3 Push to GitHub

```bash
# Add GitHub as remote origin
git remote add origin https://github.com/YOUR_USERNAME/school-app-backend.git

# Push to GitHub
git branch -M main
git push -u origin main
```

### 1.4 Verify GitHub Setup

- Go to your GitHub repository
- Verify all files are uploaded
- Check that `.env` file is **not** in the repository (it should be in `.gitignore`)

## Step 2: Heroku Setup

### 2.1 Install Heroku CLI

**Windows:**

```bash
# Download from https://devcenter.heroku.com/articles/heroku-cli
# Or use winget
winget install --id=Heroku.HerokuCLI
```

**macOS:**

```bash
brew tap heroku/brew && brew install heroku
```

**Linux:**

```bash
curl https://cli-assets.heroku.com/install.sh | sh
```

### 2.2 Login to Heroku

```bash
heroku login
```

This will open your browser to authenticate with Heroku.

### 2.3 Create Heroku App

```bash
# Create a new Heroku app
heroku create your-app-name

# Or let Heroku generate a name
heroku create
```

### 2.4 Set Environment Variables

You need to set your environment variables in Heroku. You can do this in two ways:

#### Option A: Using Heroku CLI

```bash
# Set each variable individually
heroku config:set NODE_ENV=production
heroku config:set SUPABASE_URL=your_supabase_url
heroku config:set SUPABASE_ANON_KEY=your_supabase_anon_key
heroku config:set SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
heroku config:set JWT_SECRET=your_jwt_secret
heroku config:set JWT_EXPIRES_IN=24h
heroku config:set MAX_FILE_SIZE=10485760
heroku config:set UPLOAD_PATH=uploads/
heroku config:set LOG_LEVEL=info
```

#### Option B: Using the Deployment Script

**Windows:**

```bash
# Run the Windows deployment script
scripts\deploy.bat your-app-name
```

**Linux/macOS:**

```bash
# Make script executable
chmod +x scripts/deploy.sh

# Run the deployment script
./scripts/deploy.sh your-app-name
```

### 2.5 Deploy to Heroku

```bash
# Add Heroku as a git remote (if not already done)
heroku git:remote -a your-app-name

# Deploy
git push heroku main
```

### 2.6 Verify Deployment

```bash
# Check if app is running
heroku ps

# View logs
heroku logs --tail

# Open the app
heroku open
```

## Step 3: Database Setup

### 3.1 Set up Supabase Database

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Create a new project or use existing one
3. Go to the SQL Editor
4. Run the SQL scripts in this order:

```sql
-- 1. Run the main setup script
-- Copy and paste the content of SUPABASE_SETUP_V2.sql

-- 2. Run the functions setup
-- Copy and paste the content of SETUP_FUNCTION.sql

-- 3. Run the homework table fix (if needed)
-- Copy and paste the content of FIX_HOMEWORK_TABLE.sql
```

### 3.2 Get Supabase Credentials

1. Go to your Supabase project settings
2. Copy the following values:
   - Project URL
   - Anon (public) key
   - Service role key (secret)

3. Set them in Heroku:

```bash
heroku config:set SUPABASE_URL=your_project_url
heroku config:set SUPABASE_ANON_KEY=your_anon_key
heroku config:set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Step 4: Test Your Deployment

### 4.1 Test Health Endpoint

```bash
# Test the health endpoint
curl https://your-app-name.herokuapp.com/health
```

Expected response:

```json
{ "status": "ok" }
```

### 4.2 Test API Endpoints

Use Postman or curl to test your API endpoints:

```bash
# Test registration endpoint
curl -X POST https://your-app-name.herokuapp.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "1234567890",
    "password": "password123",
    "role": "admin",
    "full_name": "Admin User"
  }'
```

## Step 5: Continuous Deployment (Optional)

### 5.1 Set up GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Heroku

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Deploy to Heroku
        uses: akhileshns/heroku-deploy@v3.12.14
        with:
          heroku_api_key: ${{ secrets.HEROKU_API_KEY }}
          heroku_app_name: ${{ secrets.HEROKU_APP_NAME }}
          heroku_email: ${{ secrets.HEROKU_EMAIL }}
```

### 5.2 Set GitHub Secrets

1. Go to your GitHub repository
2. Click "Settings" → "Secrets and variables" → "Actions"
3. Add the following secrets:
   - `HEROKU_API_KEY`: Your Heroku API key
   - `HEROKU_APP_NAME`: Your Heroku app name
   - `HEROKU_EMAIL`: Your Heroku email

## Troubleshooting

### Common Issues

#### 1. Build Failed

```bash
# Check build logs
heroku logs --tail

# Common solutions:
# - Make sure all dependencies are in package.json
# - Check that the start script is correct
# - Verify Node.js version compatibility
```

#### 2. Environment Variables Not Set

```bash
# Check current config
heroku config

# Set missing variables
heroku config:set VARIABLE_NAME=value
```

#### 3. Database Connection Issues

- Verify Supabase credentials are correct
- Check if your Supabase project is active
- Ensure database tables are created

#### 4. Port Issues

- Heroku automatically sets the PORT environment variable
- Your app should use `process.env.PORT || 3000`

### Useful Commands

```bash
# View logs
heroku logs --tail

# Check app status
heroku ps

# Open app
heroku open

# Run commands on Heroku
heroku run node -v

# Check config
heroku config

# Restart app
heroku restart
```

## Next Steps

1. **Set up monitoring**: Use Heroku add-ons for monitoring
2. **Configure custom domain**: Add your own domain to Heroku
3. **Set up SSL**: Heroku provides SSL certificates automatically
4. **Scale your app**: Upgrade to paid dynos for better performance
5. **Set up backups**: Configure database backups in Supabase

## Support

If you encounter issues:

1. Check the [Heroku Dev Center](https://devcenter.heroku.com/)
2. Review [Supabase Documentation](https://supabase.com/docs)
3. Check the logs: `heroku logs --tail`
4. Open an issue in your GitHub repository

## Security Notes

- Never commit `.env` files to Git
- Use strong JWT secrets
- Regularly rotate API keys
- Monitor your app logs for suspicious activity
- Keep dependencies updated
