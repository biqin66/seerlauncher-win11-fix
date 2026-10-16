@echo off
setlocal EnableExtensions
cd /d "%~dp0"
if not exist "%~dp0patch.bat" (
  echo [ERROR] patch.bat is missing. Unzip the full folder and try again.
  echo.
  pause
  exit /b 1
)
call "%~dp0patch.bat" %*
exit /b %ERRORLEVEL%
