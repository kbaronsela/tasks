@echo off
REM מיגרציה לפרודקשן — עובד גם כש-PowerShell חוסם npm.ps1 / npx.ps1
cd /d "%~dp0"
node "%~dp0node_modules\prisma\build\index.js" migrate deploy
exit /b %ERRORLEVEL%
