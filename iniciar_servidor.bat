@echo off
title Servidor Local - Meta Hablar Ingles
echo ==================================================
echo Iniciando el servidor local para Meta Hablar Ingles...
echo ==================================================
node server.js
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Parece que Node.js no esta respondiendo correctamente o no esta instalado.
    echo Si no tienes Node.js, puedes instalarlo gratis desde: https://nodejs.org/
    echo.
    pause
)
pause
