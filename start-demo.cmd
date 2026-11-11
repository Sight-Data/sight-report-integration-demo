@echo off
setlocal

powershell.exe -ExecutionPolicy Bypass -File "%~dp0start-demo.ps1" %*

endlocal
