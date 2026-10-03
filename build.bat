@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build_backend.ps1
if errorlevel 1 exit /b 1
call npm.cmd ci
if errorlevel 1 exit /b 1
call npm.cmd run package
