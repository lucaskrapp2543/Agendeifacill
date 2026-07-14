@echo off
chcp 65001 >nul
title Agendei Facil - Servidores (NAO FECHE esta janela)
cd /d "%~dp0"
echo.
echo =========================================================
echo    INICIANDO O SISTEMA AGENDEI FACIL
echo    (Vite na porta 5173  +  API na porta 3001)
echo =========================================================
echo.
echo  - Espere aparecer:  Local: http://localhost:5173/
echo  - Deixe ESTA JANELA ABERTA enquanto usa o sistema.
echo  - Para desligar os servidores, e so FECHAR esta janela.
echo.
echo =========================================================
echo.
call npm run dev

echo.
echo =========================================================
echo  Os servidores foram encerrados (ou houve um erro acima).
echo  Feche esta janela ou pressione uma tecla para sair.
echo =========================================================
pause >nul
