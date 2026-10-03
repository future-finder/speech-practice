@echo off
setlocal
cd /d "%~dp0"
where uv >nul 2>nul
if errorlevel 1 (
  echo Install uv first: https://docs.astral.sh/uv/getting-started/installation/
  exit /b 1
)
call uv sync --frozen
if errorlevel 1 exit /b 1
call npm.cmd ci
if errorlevel 1 exit /b 1
call npm.cmd run desktop
