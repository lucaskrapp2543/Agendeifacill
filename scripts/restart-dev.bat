@echo off
:start
echo Iniciando servidor de desenvolvimento...
npm run dev
echo Servidor caiu, reiniciando em 3 segundos...
timeout /t 3 /nobreak
goto start 