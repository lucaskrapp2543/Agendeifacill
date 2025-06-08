@echo off
echo Matando processos nas portas 5173, 5174 e 5175...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173 :5174 :5175"') do (
    taskkill /F /PID %%a 2>nul
)
echo Iniciando servidor de desenvolvimento...
cd ..
npm run dev 