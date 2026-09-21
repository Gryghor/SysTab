@echo off
setlocal EnableExtensions EnableDelayedExpansion

title Inicializador de servicos PM2
set "PM2=pm2"
set "FAILED=0"

where %PM2% >nul 2>&1
if errorlevel 1 (
    echo ERRO: PM2 nao foi encontrado no PATH.
    echo Instale-o com: npm install -g pm2
    exit /b 1
)

echo.
echo Inicializando servicos...
echo.

call :EnsureService "agnus" "C:\sys\server-stuff\agnus\backend" "src\index.js"
if errorlevel 1 set "FAILED=1"

call :EnsureService "systab" "C:\sys\server-stuff\systab\SysTab\backend" "src\server.js"
if errorlevel 1 set "FAILED=1"

call :EnsureService "VigiaSUS" "C:\sys\server-stuff\vigiasus\vigiasus-backend" "src\index.js"
if errorlevel 1 set "FAILED=1"

echo.
if "%FAILED%"=="1" (
    echo Um ou mais servicos nao puderam ser inicializados.
    call %PM2% status
    pause
    exit /b 1
)

call %PM2% save
echo.
echo Todos os servicos foram iniciados ou reiniciados com sucesso.
call %PM2% status
echo.
echo Abrindo o monitor interativo do PM2.
echo Para sair do monitor, pressione Ctrl+C.
call %PM2% monit
echo.
echo Monitor encerrado.
pause
exit /b 0

:EnsureService
set "SERVICE_NAME=%~1"
set "SERVICE_DIR=%~2"
set "SERVICE_ENTRY=%~3"

echo [%SERVICE_NAME%]
if not exist "%SERVICE_DIR%\%SERVICE_ENTRY%" (
    echo ERRO: Arquivo nao encontrado: "%SERVICE_DIR%\%SERVICE_ENTRY%"
    exit /b 1
)

pushd "%SERVICE_DIR%"
call %PM2% describe "%SERVICE_NAME%" >nul 2>&1
if errorlevel 1 (
    echo Criando processo...
    call %PM2% start "%SERVICE_ENTRY%" --name "%SERVICE_NAME%" --time
) else (
    echo Reiniciando processo existente...
    call %PM2% restart "%SERVICE_NAME%" --update-env
)
set "SERVICE_RESULT=%errorlevel%"
popd
exit /b %SERVICE_RESULT%
