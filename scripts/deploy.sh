#!/bin/bash

# School App Backend - Heroku Deployment Script

echo "🚀 Starting deployment to Heroku..."

# Check if Heroku CLI is installed
if ! command -v heroku &> /dev/null; then
    echo "❌ Heroku CLI is not installed. Please install it first:"
    echo "   https://devcenter.heroku.com/articles/heroku-cli"
    exit 1
fi

# Check if user is logged in to Heroku
if ! heroku auth:whoami &> /dev/null; then
    echo "❌ Please login to Heroku first:"
    echo "   heroku login"
    exit 1
fi

# Get app name from command line or use default
APP_NAME=${1:-"school-app-backend-$(date +%s)"}

echo "📦 App name: $APP_NAME"

# Create Heroku app if it doesn't exist
if ! heroku apps:info --app $APP_NAME &> /dev/null; then
    echo "🔧 Creating new Heroku app: $APP_NAME"
    heroku create $APP_NAME
else
    echo "✅ App $APP_NAME already exists"
fi

# Set environment variables
echo "🔐 Setting environment variables..."

# Check if .env file exists
if [ -f .env ]; then
    echo "📄 Loading environment variables from .env file..."
    export $(cat .env | grep -v '^#' | xargs)
fi

# Set required environment variables
heroku config:set NODE_ENV=production --app $APP_NAME

# Set Supabase variables (prompt user if not in .env)
if [ -z "$SUPABASE_URL" ]; then
    read -p "Enter your Supabase URL: " SUPABASE_URL
fi
heroku config:set SUPABASE_URL="$SUPABASE_URL" --app $APP_NAME

if [ -z "$SUPABASE_ANON_KEY" ]; then
    read -p "Enter your Supabase Anon Key: " SUPABASE_ANON_KEY
fi
heroku config:set SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY" --app $APP_NAME

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    read -p "Enter your Supabase Service Role Key: " SUPABASE_SERVICE_ROLE_KEY
fi
heroku config:set SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" --app $APP_NAME

# Set JWT secret
if [ -z "$JWT_SECRET" ]; then
    JWT_SECRET=$(openssl rand -base64 32)
    echo "🔑 Generated JWT secret"
fi
heroku config:set JWT_SECRET="$JWT_SECRET" --app $APP_NAME

# Set optional variables
heroku config:set JWT_EXPIRES_IN=24h --app $APP_NAME
heroku config:set MAX_FILE_SIZE=10485760 --app $APP_NAME
heroku config:set UPLOAD_PATH=uploads/ --app $APP_NAME
heroku config:set LOG_LEVEL=info --app $APP_NAME

echo "✅ Environment variables set successfully"

# Deploy to Heroku
echo "🚀 Deploying to Heroku..."
git add .
git commit -m "Deploy to Heroku - $(date)"

# Add Heroku remote if not exists
if ! git remote | grep -q heroku; then
    heroku git:remote -a $APP_NAME
fi

git push heroku main

# Check if deployment was successful
if [ $? -eq 0 ]; then
    echo "✅ Deployment successful!"
    echo "🌐 Your app is available at: https://$APP_NAME.herokuapp.com"
    echo "📊 View logs: heroku logs --tail --app $APP_NAME"
    echo "🔧 Open app: heroku open --app $APP_NAME"
else
    echo "❌ Deployment failed. Check the logs above for errors."
    exit 1
fi 