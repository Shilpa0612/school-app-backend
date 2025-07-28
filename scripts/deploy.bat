@echo off
REM School App Backend - Heroku Deployment Script (Windows)

echo 🚀 Starting deployment to Heroku...

REM Check if Heroku CLI is installed
heroku --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Heroku CLI is not installed. Please install it first:
    echo    https://devcenter.heroku.com/articles/heroku-cli
    pause
    exit /b 1
)

REM Check if user is logged in to Heroku
heroku auth:whoami >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Please login to Heroku first:
    echo    heroku login
    pause
    exit /b 1
)

REM Get app name from command line or use default
set APP_NAME=%1
if "%APP_NAME%"=="" (
    for /f "tokens=2 delims==" %%a in ('wmic OS Get localdatetime /value') do set "dt=%%a"
    set "YY=%dt:~2,2%" & set "YYYY=%dt:~0,4%" & set "MM=%dt:~4,2%" & set "DD=%dt:~6,2%"
    set "HH=%dt:~8,2%" & set "Min=%dt:~10,2%" & set "Sec=%dt:~12,2%"
    set "APP_NAME=school-app-backend-%YYYY%%MM%%DD%-%HH%%Min%%Sec%"
)

echo 📦 App name: %APP_NAME%

REM Create Heroku app if it doesn't exist
heroku apps:info --app %APP_NAME% >nul 2>&1
if %errorlevel% neq 0 (
    echo 🔧 Creating new Heroku app: %APP_NAME%
    heroku create %APP_NAME%
) else (
    echo ✅ App %APP_NAME% already exists
)

REM Set environment variables
echo 🔐 Setting environment variables...

REM Check if .env file exists
if exist .env (
    echo 📄 Loading environment variables from .env file...
    for /f "tokens=1,2 delims==" %%a in (.env) do (
        if not "%%a"=="" if not "%%a:~0,1%"=="#" (
            set "%%a=%%b"
        )
    )
)

REM Set required environment variables
heroku config:set NODE_ENV=production --app %APP_NAME%

REM Set Supabase variables (prompt user if not in .env)
if "%SUPABASE_URL%"=="" (
    set /p SUPABASE_URL="Enter your Supabase URL: "
)
heroku config:set SUPABASE_URL="%SUPABASE_URL%" --app %APP_NAME%

if "%SUPABASE_ANON_KEY%"=="" (
    set /p SUPABASE_ANON_KEY="Enter your Supabase Anon Key: "
)
heroku config:set SUPABASE_ANON_KEY="%SUPABASE_ANON_KEY%" --app %APP_NAME%

if "%SUPABASE_SERVICE_ROLE_KEY%"=="" (
    set /p SUPABASE_SERVICE_ROLE_KEY="Enter your Supabase Service Role Key: "
)
heroku config:set SUPABASE_SERVICE_ROLE_KEY="%SUPABASE_SERVICE_ROLE_KEY%" --app %APP_NAME%

REM Set JWT secret
if "%JWT_SECRET%"=="" (
    echo 🔑 Generating JWT secret...
    for /f "tokens=*" %%i in ('powershell -Command "[System.Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes([System.Guid]::NewGuid().ToString()))"') do set JWT_SECRET=%%i
)
heroku config:set JWT_SECRET="%JWT_SECRET%" --app %APP_NAME%

REM Set optional variables
heroku config:set JWT_EXPIRES_IN=24h --app %APP_NAME%
heroku config:set MAX_FILE_SIZE=10485760 --app %APP_NAME%
heroku config:set UPLOAD_PATH=uploads/ --app %APP_NAME%
heroku config:set LOG_LEVEL=info --app %APP_NAME%

echo ✅ Environment variables set successfully

REM Deploy to Heroku
echo 🚀 Deploying to Heroku...
git add .
git commit -m "Deploy to Heroku - %date% %time%"

REM Add Heroku remote if not exists
git remote | findstr heroku >nul 2>&1
if %errorlevel% neq 0 (
    heroku git:remote -a %APP_NAME%
)

git push heroku main

REM Check if deployment was successful
if %errorlevel% equ 0 (
    echo ✅ Deployment successful!
    echo 🌐 Your app is available at: https://%APP_NAME%.herokuapp.com
    echo 📊 View logs: heroku logs --tail --app %APP_NAME%
    echo 🔧 Open app: heroku open --app %APP_NAME%
) else (
    echo ❌ Deployment failed. Check the logs above for errors.
    pause
    exit /b 1
)

pause 