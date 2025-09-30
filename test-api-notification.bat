@echo off
echo Testing FCM via API...

REM First, let's check the device tokens
echo.
echo 1. Checking device tokens...
curl -H "Content-Type: application/json" http://localhost:3000/api/device-tokens

echo.
echo.
echo 2. Testing notification via API...
echo This might require authentication - checking endpoint...
curl -X POST -H "Content-Type: application/json" -d "{\"title\":\"FCM API Test\",\"message\":\"Testing FCM via API endpoint\",\"type\":\"test\"}" http://localhost:3000/api/device-tokens/test

echo.
echo Done!
