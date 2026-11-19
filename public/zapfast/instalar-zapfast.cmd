@echo off
setlocal
title ZapFast - conexion con el sistema

rem ------------------------------------------------------------------
rem  Un solo archivo, dos funciones:
rem    - sin argumentos  -> instala el protocolo zapfast:// en este PC
rem    - con argumento   -> abre ZapFast en el chat de ese numero
rem  Todo queda en el usuario actual (HKCU), no hace falta admin.
rem ------------------------------------------------------------------

if not "%~1"=="" goto abrir

:instalar
set "DIR=%LOCALAPPDATA%\ZapFastAbrir"
set "EXE=%LOCALAPPDATA%\Programs\ZapFast\zapfast.exe"

if not exist "%EXE%" (
  echo.
  echo No encontre ZapFast en:
  echo   %EXE%
  echo.
  echo Instalalo desde https://zapfast.rocks/download/ y despues
  echo volve a ejecutar este mismo archivo.
  echo.
  pause
  exit /b 1
)

if not exist "%DIR%" mkdir "%DIR%" >nul 2>&1
copy /y "%~f0" "%DIR%\abrir-zapfast.cmd" >nul

reg add "HKCU\Software\Classes\zapfast" /ve /t REG_SZ /d "URL:ZapFast" /f >nul
reg add "HKCU\Software\Classes\zapfast" /v "URL Protocol" /t REG_SZ /d "" /f >nul
reg add "HKCU\Software\Classes\zapfast\DefaultIcon" /ve /t REG_SZ /d "%EXE%,0" /f >nul
reg add "HKCU\Software\Classes\zapfast\shell\open\command" /ve /t REG_SZ /d "\"%DIR%\abrir-zapfast.cmd\" \"%%1\"" /f >nul

echo.
echo Listo. ZapFast quedo conectado con el sistema.
echo.
echo Volve al navegador y toca "Abrir en ZapFast".
echo Windows te va a preguntar una vez si queres abrir ZapFast: elegi que si.
echo.
pause
exit /b 0

:abrir
set "T=%~1"
set "T=%T:zapfast://=%"
for /f "tokens=1 delims=?/" %%A in ("%T%") do set "T=%%A"
start "" "%LOCALAPPDATA%\Programs\ZapFast\zapfast.exe" "%T%"
exit /b 0
