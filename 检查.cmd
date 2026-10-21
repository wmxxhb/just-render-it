@echo off
setlocal
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%~dp0patch.ps1" -Action Check %*
set "patchExit=%errorlevel%"
echo.
pause
exit /b %patchExit%
