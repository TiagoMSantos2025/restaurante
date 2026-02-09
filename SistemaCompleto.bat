@echo off
echo.
echo ================================================
echo    SISTEMA COMPLETO DE RESTAURANTE - INICIO
echo ================================================
echo.
echo As funcionalidades disponiveis sao:
echo.
echo 1. Cardapio Digital via QR Code
echo 2. Painel da Cozinha (KDS)
echo 3. Painel do Administrador
echo 4. Controle de Estoque
echo 5. Cadastro de Clientes
echo 6. Avaliacoes de Pedidos
echo 7. Reservas Online
echo 8. Relatorios Avancados
echo.
echo Acesse o sistema em: http://localhost:3000
echo.
echo Funcionalidades:
echo   - Principal:         http://localhost:3000
echo   - Cardapio Mesa 01:  http://localhost:3000/menu?mesa=01
echo   - Painel Cozinha:    http://localhost:3000/kitchen
echo   - Painel Admin:      http://localhost:3000/admin
echo   - Controle Estoque:  http://localhost:3000/controle-estoque
echo   - Cadastro Cliente:  http://localhost:3000/cadastro-cliente
echo   - Avaliar Pedido:    http://localhost:3000/avaliar-pedido
echo   - QR Code Mesa 01:   http://localhost:3000/qrcode/01
echo.
echo Pressione qualquer tecla para iniciar o sistema...
pause >nul
echo.
echo Iniciando o servidor...
node server_final.js