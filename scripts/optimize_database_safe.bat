@echo off
echo ========================================
echo Safe Database Performance Optimization
echo ========================================
echo.
echo This script will check which tables exist
echo before creating indexes to avoid errors.
echo.

echo Starting safe database optimization...
node scripts/apply_database_optimizations_safe.js

echo.
echo ========================================
echo Safe optimization completed!
echo ========================================
pause
