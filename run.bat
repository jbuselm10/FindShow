@echo off
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js is not on PATH. Install Node or reopen your terminal.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
)

if not exist ".env" (
  echo Warning: .env is missing. Copy .env.example and add TMDB_API_KEY.
)

echo Starting FindShow...
call npm run dev
pause
