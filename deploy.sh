#!/bin/bash

# Script de deploy para diferentes plataformas

echo "🚀 Sistema de Restaurante - Script de Deploy"
echo "============================================"

# Verificar se está sendo executado no Windows com WSL ou Git Bash
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
    echo "⚠️  Ambiente Windows detectado"
    SCRIPT_EXT=".cmd"
else
    echo "✅ Ambiente Unix/Linux detectado"
    SCRIPT_EXT=""
fi

show_menu() {
    echo ""
    echo "Escolha a plataforma para deploy:"
    echo "1) Local (desenvolvimento)"
    echo "2) Heroku"
    echo "3) Railway"
    echo "4) Render"
    echo "5) VPS/Servidor Dedicado"
    echo "6) Verificar configurações"
    echo "7) Sair"
    echo ""
    read -p "Digite sua opção [1-7]: " choice
}

local_deploy() {
    echo ""
    echo "📍 Deploy local (desenvolvimento)"
    echo "-----------------------------------"
    echo "Executando em modo de desenvolvimento..."
    echo "Acesse em: http://localhost:3000"
    echo ""
    echo "Pressione Ctrl+C para parar o servidor"
    npm run dev
}

heroku_deploy() {
    echo ""
    echo "📦 Deploy para Heroku"
    echo "----------------------"
    echo "Certifique-se de ter o Heroku CLI instalado"
    echo ""
    echo "Passos para deploy no Heroku:"
    echo "1. heroku login"
    echo "2. heroku create nome-do-app"
    echo "3. heroku buildpacks:set heroku/nodejs"
    echo "4. heroku addons:create heroku-postgresql:hobby-dev"
    echo "5. git push heroku main"
    echo ""
    read -p "Deseja executar heroku login agora? (s/n): " confirm
    if [[ $confirm == "s" || $confirm == "S" ]]; then
        heroku login
    fi
}

railway_deploy() {
    echo ""
    echo "🚂 Deploy para Railway"
    echo "-----------------------"
    echo "Certifique-se de ter o Railway CLI instalado"
    echo ""
    echo "Passos para deploy no Railway:"
    echo "1. railway login"
    echo "2. railway init"
    echo "3. railway up"
    echo "4. Configure DATABASE_URL como variável de ambiente"
    echo ""
    read -p "Deseja executar railway login agora? (s/n): " confirm
    if [[ $confirm == "s" || $confirm == "S" ]]; then
        railway login
    fi
}

render_deploy() {
    echo ""
    echo "🎯 Deploy para Render"
    echo "----------------------"
    echo "O deploy para Render é feito via integração com GitHub/GitLab"
    echo ""
    echo "Passos para deploy no Render:"
    echo "1. Crie uma conta no Render.com"
    echo "2. Conecte com seu repositório Git"
    echo "3. Crie um novo Web Service"
    echo "4. Selecione seu repositório"
    echo "5. Configure como:"
    echo "   - Environment: Node.js"
    echo "   - Build Command: npm install"
    echo "   - Start Command: npm start"
    echo "6. Adicione variáveis de ambiente conforme necessário"
    echo ""
}

vps_deploy() {
    echo ""
    echo "🖥️  Deploy em VPS/Servidor Dedicado"
    echo "------------------------------------"
    echo "Script para configurar em servidor Linux:"
    echo ""
    echo "# Atualizar sistema"
    echo "sudo apt update && sudo apt upgrade -y"
    echo ""
    echo "# Instalar Node.js"
    echo "curl -sL https://deb.nodesource.com/setup_18.x | sudo -E bash -"
    echo "sudo apt install -y nodejs"
    echo ""
    echo "# Instalar PM2"
    echo "npm install -g pm2"
    echo ""
    echo "# Clonar repositório"
    echo "git clone <seu-repositorio>"
    echo "cd <diretorio-do-projeto>"
    echo ""
    echo "# Instalar dependências"
    echo "npm install"
    echo ""
    echo "# Iniciar aplicação"
    echo "pm2 start server_final.js --name restaurant-system"
    echo "pm2 startup"
    echo "pm2 save"
    echo ""
    echo "# Opcional: Configurar Nginx como proxy reverso"
    echo "sudo apt install nginx"
    echo ""
}

check_config() {
    echo ""
    echo "🔍 Verificando configurações"
    echo "----------------------------"
    echo "Versão do Node: $(node --version)"
    echo "Versão do NPM: $(npm --version)"
    echo ""
    
    if command -v heroku &> /dev/null; then
        echo "✅ Heroku CLI: instalado"
    else
        echo "❌ Heroku CLI: não encontrado"
    fi
    
    if command -v railway &> /dev/null; then
        echo "✅ Railway CLI: instalado"
    else
        echo "❌ Railway CLI: não encontrado"
    fi
    
    if command -v git &> /dev/null; then
        echo "✅ Git: instalado"
        echo "Branch atual: $(git branch --show-current 2>/dev/null || echo 'N/A')"
    else
        echo "❌ Git: não encontrado"
    fi
    
    echo ""
    echo "Arquivos importantes:"
    if [[ -f "package.json" ]]; then echo "✅ package.json"; else echo "❌ package.json"; fi
    if [[ -f "Procfile" ]]; then echo "✅ Procfile"; else echo "❌ Procfile"; fi
    if [[ -f "server_final.js" ]]; then echo "✅ server_final.js"; else echo "❌ server_final.js"; fi
    if [[ -f ".env.example" ]]; then echo "✅ .env.example"; else echo "❌ .env.example"; fi
}

while true; do
    show_menu
    case $choice in
        1)
            local_deploy
            ;;
        2)
            heroku_deploy
            ;;
        3)
            railway_deploy
            ;;
        4)
            render_deploy
            ;;
        5)
            vps_deploy
            ;;
        6)
            check_config
            ;;
        7)
            echo ""
            echo "👋 Até logo!"
            exit 0
            ;;
        *)
            echo ""
            echo "❌ Opção inválida. Por favor, escolha entre 1-7."
            ;;
    esac
    
    echo ""
    read -p "Pressione Enter para continuar..."
done