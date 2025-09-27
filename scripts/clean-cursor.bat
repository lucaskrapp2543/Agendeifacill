@echo off
echo ==============================================
echo    LIMPANDO CACHE DO CURSOR - SOLUCAO
echo ==============================================
echo.

echo 🧹 Removendo cache do node_modules...
if exist "node_modules/.vite" (
    rmdir /s /q "node_modules\.vite"
    echo ✅ Cache do Vite removido
)

echo 🧹 Removendo arquivos de cache...
if exist ".eslintcache" (
    del ".eslintcache"
    echo ✅ ESLint cache removido
)

if exist "dist" (
    rmdir /s /q "dist"
    echo ✅ Pasta dist removida
)

echo.
echo ✨ COMPLETADO! 
echo.
echo 📋 SIGA ESTES PASSOS:
echo 1. Feche o Cursor completamente
echo 2. Reabra o projeto
echo 3. Execute: npm install
echo 4. Execute: npm run dev
echo.
pause

