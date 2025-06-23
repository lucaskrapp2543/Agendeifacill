@echo off
echo Restaurando para o ponto X...
echo.

:: Parar o servidor de desenvolvimento se estiver rodando
taskkill /F /IM node.exe >nul 2>&1

:: Limpar a pasta atual
cd ..
rmdir /S /Q "project\src" 2>nul
rmdir /S /Q "project\public" 2>nul
del /Q "project\*.json" 2>nul
del /Q "project\*.js" 2>nul
del /Q "project\*.ts" 2>nul

:: Restaurar do backup
xcopy /E /I /H /Y "project_backup_restauracao\*" "project\"

:: Reinstalar dependências
cd project
call npm install

echo.
echo ====================================
echo Projeto restaurado para o ponto X!
echo Agora você pode executar 'npm run dev'
echo ==================================== 