@echo off
echo Testing FCM via curl with authentication...

REM Generate token first
echo Generating JWT token...
node -e "const jwt = require('jsonwebtoken'); const dotenv = require('dotenv'); dotenv.config(); const token = jwt.sign({user_id: '34e0bb46-ec50-4fec-ac30-4e33f3ced66c', role: 'parent'}, process.env.JWT_SECRET, {expiresIn: '1h'}); console.log('TOKEN=' + token);" > token.txt

REM Extract token
for /f "tokens=*" %%i in (token.txt) do set %%i

echo.
echo Testing FCM notification...
curl -X POST ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer %TOKEN%" ^
  -d "{\"title\":\"FCM Fixed Test\",\"message\":\"Testing FCM with corrected payload structure\"}" ^
  http://localhost:3000/api/device-tokens/test

echo.
echo Cleaning up...
del token.txt

echo.
echo Done!
