@echo off
setlocal EnableExtensions
title SeerLauncher Patcher

:: ASCII-only until after elevation. UTF-8 Chinese in .bat is parsed as GBK
:: on Chinese Windows and turns comments into fake commands.
net session >nul 2>&1
if not errorlevel 1 goto GOT_ADMIN

echo.
echo Requesting Administrator (UAC)...
echo Click Yes in the popup.
echo The patch runs in a NEW admin window. Do not close that window.
echo.

set "SEE_PATCH_SELF=%~f0"
set "PS="
if exist "%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" set "PS=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if not defined PS if exist "%SystemRoot%\SysWOW64\WindowsPowerShell\v1.0\powershell.exe" set "PS=%SystemRoot%\SysWOW64\WindowsPowerShell\v1.0\powershell.exe"

set "ELEV_ERR=1"
set "ELEV_WAIT=0"
if not defined PS goto TRY_VBS
if not exist "%~dp0elevate.ps1" goto TRY_VBS
"%PS%" -NoProfile -ExecutionPolicy Bypass -File "%~dp0elevate.ps1"
set "ELEV_ERR=%ERRORLEVEL%"
if "%ELEV_ERR%"=="0" goto ELEV_OK
if "%ELEV_ERR%"=="2" goto ELEV_CANCEL

:TRY_VBS
echo PowerShell elevate failed, trying VBScript fallback...
set "CSCRIPT=%SystemRoot%\System32\cscript.exe"
if not exist "%CSCRIPT%" set "CSCRIPT=%SystemRoot%\SysWOW64\cscript.exe"
if not exist "%~dp0elevate.vbs" goto ELEV_FAIL
if not exist "%CSCRIPT%" goto ELEV_FAIL
"%CSCRIPT%" //nologo "%~dp0elevate.vbs" "%SEE_PATCH_SELF%"
set "ELEV_ERR=%ERRORLEVEL%"
if "%ELEV_ERR%"=="0" (
  set "ELEV_WAIT=1"
  goto ELEV_OK
)
goto ELEV_FAIL

:ELEV_OK
echo Elevation request sent. Continue in the new Administrator window.
if "%ELEV_WAIT%"=="1" (
  echo If no UAC or new window appeared, right-click patch.bat - Run as administrator.
  echo.
  pause
  exit /b 0
)
exit /b 0

:ELEV_CANCEL
echo.
echo [ERROR] UAC was cancelled. Run again and click Yes.
echo Or right-click patch.bat - Run as administrator.
echo.
pause
exit /b 1

:ELEV_FAIL
echo.
echo [ERROR] Auto-elevate failed.
echo   - If you clicked No on UAC, run again and click Yes
echo   - Or right-click patch.bat - Run as administrator
echo.
pause
exit /b 1

:GOT_ADMIN
chcp 65001 >nul
cd /d "%~dp0"
if errorlevel 1 (
  echo [ERROR] Cannot cd to script folder:
  echo   %~dp0
  echo.
  pause
  exit /b 1
)

echo ========================================
echo   SeerLauncher Patcher
echo ========================================
echo.

:: Admin PATH often misses a per-user Node.js install.
set "NODE="
if exist "%SystemRoot%\System32\where.exe" for /f "delims=" %%i in ('"%SystemRoot%\System32\where.exe" node 2^>nul') do if not defined NODE set "NODE=%%i"
if not defined NODE if exist "%ProgramFiles%\nodejs\node.exe" set "NODE=%ProgramFiles%\nodejs\node.exe"
if not defined NODE if exist "%ProgramFiles(x86)%\nodejs\node.exe" set "NODE=%ProgramFiles(x86)%\nodejs\node.exe"
if not defined NODE if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" set "NODE=%LOCALAPPDATA%\Programs\nodejs\node.exe"
if not defined NODE if exist "%USERPROFILE%\scoop\apps\nodejs\current\node.exe" set "NODE=%USERPROFILE%\scoop\apps\nodejs\current\node.exe"
if not defined NODE (
  echo [ERROR] Node.js not found.
  echo Install Node.js from https://nodejs.org then run this script again.
  echo If it is already installed, use the official system-wide installer
  echo ^(not a current-user-only install^).
  echo.
  pause
  exit /b 1
)

echo Using Node.js: %NODE%
echo.

"%NODE%" "%~dp0seer_patch.js" %*
set "PATCH_ERR=%ERRORLEVEL%"
echo.
if not "%PATCH_ERR%"=="0" (
  echo [ERROR] Patch did not finish, exit code %PATCH_ERR%
  echo See the message above. This window will stay open.
  echo.
  pause
  exit /b %PATCH_ERR%
)
echo This window will close in 8 seconds. Press any key to close now.
timeout /t 8 >nul
exit /b 0
