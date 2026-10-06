@echo off
setlocal
cd /d "%~dp0"
set "PATH=%~dp0nodejs;%PATH%"
echo =======================================================
echo   Starting Assignment Submission Portal...
echo   Open in browser: http://localhost:5000
echo =======================================================
node server.js
pause
