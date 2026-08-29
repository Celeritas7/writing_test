@echo off
title Written Test - Learning Hub local server
REM Put this .bat in your writing_test folder (next to learning_hub.html)
REM and double-click it. Leave this window open while using the app.
REM Supabase auth + data work fine from localhost.
REM Use Chrome or Edge if you want the iCloud folder export to work.
cd /d "%~dp0"

set "ROOT=."
set "PORT=5182"
set "PAGE=learning_hub.html"

if not exist "%ROOT%\%PAGE%" (
  echo Could not find %PAGE% here.
  echo Put this .bat in the same folder as learning_hub.html.
  echo Current folder: %CD%
  pause & goto :eof
)

REM --- Find a Python: PATH first, then common Anaconda/Miniconda locations ---
REM (double-clicking uses plain cmd, where conda's PATH is usually NOT active,
REM  so we look for python.exe directly.)
set "PY="
for %%P in (
  "python.exe"
  "%USERPROFILE%\anaconda3\python.exe"
  "%USERPROFILE%\miniconda3\python.exe"
  "%USERPROFILE%\AppData\Local\anaconda3\python.exe"
  "%USERPROFILE%\AppData\Local\miniconda3\python.exe"
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
  echo Could not find Python automatically.
  echo Open "Anaconda Prompt", cd to this folder, and run:
  echo     python -m http.server %PORT% --directory "%ROOT%"
  echo.
  pause & goto :eof
)

echo.
echo   Written Test - Learning Hub
echo   Python:  %PY%
echo   Serving: %ROOT%    Open: http://localhost:%PORT%/%PAGE%
echo.
echo   Library     browse subjects and topics
echo   Build       rank the next batch and export PDF to iCloud
echo   Review      Cowork feedback on solved sheets
echo   Ghost test  write on screen with Apple Pencil, tally with the key
echo.
echo   (Close this window to stop.)
echo.

start "" "http://localhost:%PORT%/%PAGE%"
"%PY%" -m http.server %PORT% --directory "%ROOT%"

echo.
echo Server stopped.
pause
