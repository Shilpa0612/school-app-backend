@echo off
echo ========================================
echo Heroku Deployment Fix Script
echo ========================================

echo.
echo 1. Checking git status...
git status

echo.
echo 2. Adding all changes...
git add .

echo.
echo 3. Committing changes...
git commit -m "Fix attendance.js ES module syntax and authentication issues"

echo.
echo 4. Pushing to Heroku...
git push heroku main

echo.
echo 5. Checking Heroku logs...
echo Press Ctrl+C to stop watching logs
heroku logs --tail

echo.
echo Deployment completed!
pause
