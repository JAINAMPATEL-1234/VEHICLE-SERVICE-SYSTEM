s@echo off
title AutoCare Service Hub
echo Starting AutoCare Service Hub server...

where node >nul 2>nul
if %errorlevel% equ 0 (
  node server.js
) else if exist "C:\Users\jaina\AppData\Roaming\Antigravity\bin\agy-node.cmd" (
  call "C:\Users\jaina\AppData\Roaming\Antigravity\bin\agy-node.cmd" server.js
) else (
  node server.js
)

pause
