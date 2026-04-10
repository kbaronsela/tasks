@echo off
REM שרת פיתוח — עוקף חסימת npm.ps1 ב-PowerShell
cd /d "%~dp0"
call "%~dp0node_modules\.bin\next.cmd" dev
exit /b %ERRORLEVEL%
