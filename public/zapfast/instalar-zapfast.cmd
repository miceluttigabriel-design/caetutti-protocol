@echo off
setlocal
title ZapFast - conexion con el sistema

rem ------------------------------------------------------------------
rem  Instalador de una sola vez.
rem  Conecta el navegador con ZapFast: registra el protocolo zapfast://
rem  para que el panel pueda abrir el chat, pegar el mensaje y enviarlo.
rem  Todo queda en el usuario actual (HKCU), no hace falta admin.
rem ------------------------------------------------------------------

set "DIR=%LOCALAPPDATA%\ZapFastAbrir"
set "EXE=%LOCALAPPDATA%\Programs\ZapFast\zapfast.exe"
set "PS1=%DIR%\abrir-zapfast.ps1"
set "DESCARGA=https://caetutti-protocol.vercel.app/zapfast/abrir-zapfast.ps1"

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

if exist "%~dp0abrir-zapfast.ps1" (
  copy /y "%~dp0abrir-zapfast.ps1" "%PS1%" >nul
) else (
  echo Descargando el conector...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -UseBasicParsing '%DESCARGA%' -OutFile '%PS1%' } catch { exit 1 }"
)

if not exist "%PS1%" (
  echo.
  echo No pude descargar el conector. Fijate que tengas internet
  echo y volve a ejecutar este archivo.
  echo.
  pause
  exit /b 1
)

rem Limpia la version vieja (la que solo abria el chat).
if exist "%DIR%\abrir-zapfast.cmd" del /f /q "%DIR%\abrir-zapfast.cmd" >nul 2>&1

reg add "HKCU\Software\Classes\zapfast" /ve /t REG_SZ /d "URL:ZapFast" /f >nul
reg add "HKCU\Software\Classes\zapfast" /v "URL Protocol" /t REG_SZ /d "" /f >nul
reg add "HKCU\Software\Classes\zapfast\DefaultIcon" /ve /t REG_SZ /d "%EXE%,0" /f >nul
reg add "HKCU\Software\Classes\zapfast\shell\open\command" /ve /t REG_SZ /d "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File \"%PS1%\" \"%%1\"" /f >nul

echo.
echo Listo. ZapFast quedo conectado con el sistema.
echo.
echo Volve al navegador y toca "Abrir en ZapFast".
echo Windows te va a preguntar una vez si queres abrir ZapFast: elegi que si.
echo Desde la proxima, el mensaje se pega y se envia solo.
echo.
pause
exit /b 0
