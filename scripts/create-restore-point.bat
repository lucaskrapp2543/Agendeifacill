@echo off
:: ============================================
:: Script: create-restore-point.bat
:: Objetivo: Criar um ponto de restauração completo
::           do diretório "project" dentro de
::           backups/restore_YYYYMMDD_HHMM
:: Uso:      Clique duplo ou execute no PowerShell/Prompt
:: ============================================

REM Obter data e hora (formato YYYYMMDD_HHMM)
for /f "tokens=1-4 delims=/ " %%a in ("%date%") do set todaysdate=%%d%%b%%c
for /f "tokens=1-2 delims=:" %%a in ("%time%") do set timepart=%%a%%b
set timestamp=%todaysdate%_%timepart%

REM Caminho de destino do backup
set backupDir=backups\restore_%timestamp%

REM Criar diretório de backup
mkdir "%backupDir%"

REM Copiar todos os arquivos do projeto, exceto a própria pasta backups
robocopy . "%backupDir%" /MIR /XD "%backupDir%" backups  /XF *.lock

ECHO =====================================================
ECHO Backup concluído!
ECHO Diretório criado: %backupDir%
ECHO Para restaurar:
ECHO 1) Apague ou renomeie a pasta "project" atual.
ECHO 2) Copie o conteúdo de %backupDir% para o local original.
ECHO =====================================================

pause 