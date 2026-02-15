@echo off
REM ====================================
REM RFID Desktop Application Launcher
REM Chainway R3 RFID Reader with WebSocket
REM ====================================

echo Compiling RFID Desktop Application...
echo.

REM Compile the source file
javac -cp "libs\*" -d . src\RfidSwingWebSocketApp.java

if errorlevel 1 (
    echo.
    echo Error: Compilation failed!
    echo Please check:
    echo - Java JDK is installed and in PATH
    echo - All JAR files are in libs folder
    pause
    exit /b 1
)

echo Compilation successful!
echo.
echo Starting RFID Desktop Application...
echo WebSocket Server: ws://localhost:8081
echo.

REM Run the application with all required libraries
java -cp ".;libs\*" RfidSwingWebSocketApp

REM Keep window open if there's an error
if errorlevel 1 (
    echo.
    echo Error: Application failed to start!
    echo Please check:
    echo - All JAR files are in libs folder
    echo - UHFAPI.dll is in the project root
    echo - RFID reader is connected
    pause
)
