@echo off
chcp 65001 >nul
title SeerLauncher 通用补丁器

:: ---- 自动提权（写入 Program Files 需要管理员） ----
net session >nul 2>&1
if errorlevel 1 (
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

:: ---- 定位 Node.js ----
set "NODE="
for /f "delims=" %%i in ('where node 2^>nul') do if not defined NODE set "NODE=%%i"
if not defined NODE if exist "%ProgramFiles%\nodejs\node.exe" set "NODE=%ProgramFiles%\nodejs\node.exe"
if not defined NODE (
  echo.
  echo [ERROR] 未检测到 Node.js / Node.js not found.
  echo 请先安装 Node.js: https://nodejs.org  然后重新运行本脚本。
  echo.
  pause
  exit /b 1
)

cd /d "%~dp0"
"%NODE%" "%~dp0seer_patch.js"
echo.
pause
