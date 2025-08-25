@echo off
echo ========================================
echo DEPLOY PWA - ANTI-CACHE VERSION
echo ========================================

REM Adicionar timestamp único
set TIMESTAMP=%date:~-4,4%%date:~-10,2%%date:~-7,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set TIMESTAMP=%TIMESTAMP: =0%

REM Definir versão única
set REACT_APP_VERSION=%TIMESTAMP%

echo Versao: %REACT_APP_VERSION%

REM Limpar cache do npm
echo Limpando cache...
npm cache clean --force

REM Remover node_modules e reinstalar
echo Removendo node_modules...
rmdir /s /q node_modules
del package-lock.json

REM Reinstalar dependências
echo Reinstalando dependencias...
npm install

REM Build com timestamp único
echo Fazendo build...
set "REACT_APP_VERSION=%TIMESTAMP%" && npm run build

REM Deploy
echo Fazendo deploy...
netlify deploy --prod --dir=dist

echo ========================================
echo DEPLOY CONCLUIDO!
echo Versao: %REACT_APP_VERSION%
echo ========================================
pause
