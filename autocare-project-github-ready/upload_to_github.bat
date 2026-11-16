@echo off
title Upload to GitHub - AutoCare Service Hub
echo ===================================================
echo AutoCare Service Hub - GitHub Automated Uploader
echo Repository: https://github.com/JAINAMPATEL-1234/VEHICLE-SERVICE-SYSTEM.git
echo ===================================================
echo.

where git >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Git is not found on your system PATH.
    echo Please download and install Git from: https://git-scm.com/download/win
    echo (After installing Git, just double-click this file again!)
    echo.
    echo NOTE: You can also upload 'autocare-project-github-ready.zip' directly 
    echo to your GitHub repository using the "Upload files" button on github.com!
    echo.
    pause
    exit /b 1
)

echo [1/5] Initializing Git repository...
if not exist ".git" (
    git init
    git branch -M main
)

echo [2/5] Setting remote origin...
git remote remove origin 2>nul
git remote add origin https://github.com/JAINAMPATEL-1234/VEHICLE-SERVICE-SYSTEM.git

echo [3/5] Staging files (safely ignoring node_modules and .env)...
git add .

echo [4/5] Creating commit...
git commit -m "Initial commit: AutoCare Service Hub with Supabase PostgreSQL database integration"

echo [5/5] Pushing files to GitHub...
git push -u origin main

echo.
echo ===================================================
echo Done! Check your GitHub repository:
echo https://github.com/JAINAMPATEL-1234/VEHICLE-SERVICE-SYSTEM
echo ===================================================
pause
