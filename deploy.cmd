@echo off
setlocal EnableDelayedExpansion

title Sistema de Restaurante - Script de Deploy

echo.
echo ###############################################################################
echo                    Sistema de Restaurante - Script de Deploy
echo ###############################################################################
echo.

:menu
echo.
echo Escolha a plataforma para deploy:
echo.
echo 1) Local (desenvolvimento)
echo 2) Heroku
echo 3) Railway
echo 4) Render
echo 5) VPS/Servidor Dedicado
echo 6) Verificar configuracoes
echo 7) Sair
echo.
set /p choice=Digite sua opcao [1-7]: 

if "!choice!"=="1" goto local_deploy
if "!choice!"=="2" goto heroku_deploy
if "!choice!"=="3" goto railway_deploy
if "!choice!"=="4" goto render_deploy
if "!choice!"=="5" goto vps_deploy
if "!choice!"=="6" goto check_config
if "!choice!"=="7" goto exit_app

echo.
echo Erro: Opcao invalida. Por favor, escolha entre 1-7.
timeout /t 2 /nobreak >nul
goto menu

:local_deploy
cls
echo.
echo Local Deploy (Desenvolvimento)
echo ==============================
echo Executando em modo de desenvolvimento...
echo Acesse em: http://localhost:3000
echo.
echo Pressione Ctrl+C para parar o servidor
echo.
call npm run dev
pause
goto menu

:heroku_deploy
cls
echo.
echo Deploy para Heroku
echo ==================
echo Certifique-se de ter o Heroku CLI instalado
echo.
echo Passos para deploy no Heroku:
echo 1. heroku login
echo 2. heroku create nome-do-app
echo 3. heroku buildpacks:set heroku/nodejs
echo 4. heroku addons:create heroku-postgresql:hobby-dev
echo 5. git push heroku main
echo.
set /p confirm=Deseja executar heroku login agora? (s/n): 
if /i "!confirm!"=="s" (
    heroku login
)
pause
goto menu

:railway_deploy
cls
echo.
echo Deploy para Railway
echo ===================
echo Certifique-se de ter o Railway CLI instalado
echo.
echo Passos para deploy no Railway:
echo 1. railway login
echo 2. railway init
echo 3. railway up
echo 4. Configure DATABASE_URL como variavel de ambiente
echo.
set /p confirm=Deseja executar railway login agora? (s/n): 
if /i "!confirm!"=="s" (
    railway login
)
pause
goto menu

:render_deploy
cls
echo.
echo Deploy para Render
echo ==================
echo O deploy para Render eh feito via integracao com GitHub/GitLab
echo.
echo Passos para deploy no Render:
echo 1. Crie uma conta no Render.com
echo 2. Conecte com seu repositorio Git
echo 3. Crie um novo Web Service
echo 4. Selecione seu repositorio
echo 5. Configure como:
echo    - Environment: Node.js
echo    - Build Command: npm install
echo    - Start Command: npm start
echo 6. Adicione variaveis de ambiente conforme necessario
echo.
pause
goto menu

:vps_deploy
cls
echo.
echo Deploy em VPS/Servidor Dedicado
echo ===============================
echo Comandos para configurar em servidor Windows:
echo.
echo 1. Instale o Node.js a partir de https://nodejs.org/
echo 2. Abra o CMD como administrador
echo 3. Instale o PM2: npm install -g pm2
echo 4. Clone este repositorio
echo 5. Acesse o diretorio do projeto
echo 6. Instale as dependencias: npm install
echo 7. Inicie a aplicacao: pm2 start server_final.js --name restaurant-system
echo.
pause
goto menu

:check_config
cls
echo.
echo Verificando configuracoes
echo =========================
echo Versao do Node: 
node --version
echo Versao do NPM: 
npm --version
echo.
where git >nul 2>&1
if !errorlevel! == 0 (
    echo Git: instalado
    for /f %%i in ('git branch ^| findstr ^*') do set branch=%%i
    echo Branch atual: !branch:~2!
) else (
    echo Git: nao encontrado
)
echo.
where heroku >nul 2>&1
if !errorlevel! == 0 (
    echo Heroku CLI: instalado
) else (
    echo Heroku CLI: nao encontrado
)
echo.
where railway >nul 2>&1
if !errorlevel! == 0 (
    echo Railway CLI: instalado
) else (
    echo Railway CLI: nao encontrado
)
echo.
if exist "package.json" (echo Arquivo package.json: encontrado) else (echo Arquivo package.json: nao encontrado)
if exist "Procfile" (echo Arquivo Procfile: encontrado) else (echo Arquivo Procfile: nao encontrado)
if exist "server_final.js" (echo Arquivo server_final.js: encontrado) else (echo Arquivo server_final.js: nao encontrado)
if exist ".env.example" (echo Arquivo .env.example: encontrado) else (echo Arquivo .env.example: nao encontrado)
echo.
pause
goto menu

:exit_app
echo.
echo Ate logo!
timeout /t 2 /nobreak >nul
exit /b