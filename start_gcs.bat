@echo off
title VASU-X Ground Control Server
color 0B

echo ==================================================
echo   Booting VASU-X Ground Control System...
echo ==================================================
echo.

:: Start the Node.js server in the background
start /b node server.js

:: Wait 3 seconds to ensure the server is fully running
timeout /t 3 /nobreak > NUL

:: Open the default web browser to the local dashboard
start http://localhost:3000

echo UI launched in your web browser.
echo Do not close this window during the flight.
echo.
pause