@echo off
REM מיגרציה בפיתוח (אינטראקטיבי) — עובד גם כש-PowerShell חוסם npm.ps1
cd /d "%~dp0"
node "%~dp0node_modules\prisma\build\index.js" migrate dev
exit /b %ERRORLEVEL%
