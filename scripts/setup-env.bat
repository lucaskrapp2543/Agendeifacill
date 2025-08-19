@echo off
echo 🔧 Configuração das Variáveis de Ambiente
echo ========================================

echo.
echo 📝 Criando arquivo .env...

if exist .env (
    echo ⚠️  Arquivo .env já existe!
    echo.
    set /p choice="Deseja sobrescrever? (s/n): "
    if /i "%choice%" neq "s" goto :end
)

echo # Supabase Configuration > .env
echo VITE_SUPABASE_URL=sua_url_do_supabase >> .env
echo VITE_SUPABASE_ANON_KEY=sua_chave_anonima_do_supabase >> .env
echo. >> .env
echo # Development Configuration >> .env
echo VITE_APP_ENV=development >> .env
echo VITE_APP_VERSION=1.0.0 >> .env

echo.
echo ✅ Arquivo .env criado com sucesso!
echo.
echo 📋 Próximos passos:
echo 1. Abra o arquivo .env em um editor de texto
echo 2. Substitua 'sua_url_do_supabase' pela URL real do Supabase
echo 3. Substitua 'sua_chave_anonima_do_supabase' pela chave anônima real
echo 4. Salve o arquivo
echo 5. Execute 'npm run dev-fresh' para reiniciar o servidor
echo.
echo 🔗 Para obter essas informações:
echo - Acesse: https://supabase.com/dashboard
echo - Vá em Settings ^> API
echo - Copie a URL e a anon key

:end
echo.
echo Pressione qualquer tecla para sair...
pause >nul
