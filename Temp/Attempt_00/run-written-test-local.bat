@echo off
title Written Test - Learning Hub local server
REM ---------------------------------------------------------------------
REM Put this .bat in your writing_test folder (next to learning_hub.html)
REM and double-click it. Leave this window open while using the app.
REM
REM Expected layout:
REM   learning_hub.html
REM   css\learning_hub.css
REM   js\learning_hub.js  js\ghost_test.js  js\japanese_source.js
REM   sql\*.sql            (not served, just kept here)
REM
REM Serves with Cache-Control: no-store, so swapping a .js or .css file
REM takes effect on a normal reload - no more hard-refresh guessing.
REM Supabase auth + data work fine from localhost.
REM Use Chrome or Edge if you want the iCloud folder export to work.
REM ---------------------------------------------------------------------
cd /d "%~dp0"

set "PORT=5182"
set "PAGE=index.html"

REM --- sanity: the page and both asset folders must be here -------------
set "MISSING="
if not exist "%PAGE%"                 set "MISSING=%MISSING% %PAGE%"
if not exist "css\learning_hub.css"   set "MISSING=%MISSING% css\learning_hub.css"
if not exist "js\learning_hub.js"     set "MISSING=%MISSING% js\learning_hub.js"
if not exist "js\ghost_test.js"       set "MISSING=%MISSING% js\ghost_test.js"
if not exist "js\japanese_source.js"  set "MISSING=%MISSING% js\japanese_source.js"

if defined MISSING (
  echo.
  echo   Missing:%MISSING%
  echo.
  echo   This .bat must sit in the folder that holds learning_hub.html,
  echo   with the css\ and js\ folders beside it.
  echo   Current folder: %CD%
  echo.
  pause & goto :eof
)

REM --- find a Python: PATH first, then common Anaconda/Miniconda spots --
REM (double-clicking uses plain cmd, where conda's PATH is usually NOT
REM  active, so we look for python.exe directly.)
set "PY="
for %%P in (
  "python.exe"
  "%USERPROFILE%\anaconda3\python.exe"
  "%USERPROFILE%\miniconda3\python.exe"
  "%USERPROFILE%\AppData\Local\anaconda3\python.exe"
  "%USERPROFILE%\AppData\Local\miniconda3\python.exe"
  "%LOCALAPPDATA%\Programs\Python\Python313\python.exe"
  "%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
  "%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
  "C:\ProgramData\anaconda3\python.exe"
  "C:\ProgramData\miniconda3\python.exe"
) do (
  if not defined PY (
    "%%~P" -c "import sys" >nul 2>nul && set "PY=%%~P"
  )
)

if not defined PY (
  echo.
  echo   Could not find Python automatically.
  echo   Open "Anaconda Prompt", cd to this folder, and run:
  echo       python -m http.server %PORT%
  echo.
  pause & goto :eof
)

REM --- if the port is busy, walk up until one is free -------------------
set /a TRIES=0
:findport
netstat -ano | findstr /r /c:"LISTENING.*:%PORT% " >nul 2>nul
if not errorlevel 1 (
  set /a PORT+=1
  set /a TRIES+=1
  if %TRIES% lss 12 goto findport
  echo   Could not find a free port near 5182. Close the other server and retry.
  pause & goto :eof
)

echo.
echo   Written Test - Learning Hub
echo   Python:  %PY%
echo   Serving: %CD%
echo   Open:    http://localhost:%PORT%/%PAGE%
echo   Caching: off (no-store) - a normal reload picks up edited js/css
echo.
echo   Library     browse subjects and topics
echo   Build       rank the next batch and export PDF to iCloud
echo   Review      Cowork feedback on solved sheets
echo   Ghost test  write on screen with Apple Pencil, tally with the key
echo.
echo   (Close this window to stop.)
echo.

start "" "http://localhost:%PORT%/%PAGE%"

REM no-store handler; falls back to the plain server on older Pythons
"%PY%" -c "import http.server as h;H=h.SimpleHTTPRequestHandler;_e=H.end_headers;H.end_headers=lambda s:(s.send_header('Cache-Control','no-store, max-age=0'),s.send_header('Pragma','no-cache'),_e(s));h.test(HandlerClass=H,port=%PORT%)" 2>nul
if errorlevel 1 (
  echo.
  echo   no-cache server unavailable - falling back to plain http.server.
  echo   Remember to hard-refresh ^(Ctrl+Shift+R^) after editing js or css.
  echo.
  "%PY%" -m http.server %PORT%
)

echo.
echo Server stopped.
pause
