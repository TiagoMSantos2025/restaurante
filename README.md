# Sistema de Restaurante com QR Code

Um sistema completo para restaurantes que permite aos clientes fazer pedidos através de QR Codes, com painéis de controle para cozinha e administração.

## 🚀 Funcionalidades

- **Cardápio digital via QR Code**: Clientes escaneiam o QR Code na mesa e acessam o cardápio diretamente no celular
- **Painel da cozinha (KDS)**: Visualização em tempo real dos pedidos com status e tempo de espera
- **Painel do administrador**: Controle de mesas, pedidos e estatísticas
- **Sistema de status de pedidos**: Pendente → Em preparo → Pronto → Entregue
- **Impressão de comandas**: Funcionalidade de impressão térmica integrada
- **Histórico de pedidos**: Armazenamento completo para análise de preferências
- **Sistema de avaliações**: Clientes podem avaliar pratos e serviço após o pedido
- **Controle de estoque**: Monitoramento automático de ingredientes e pratos disponíveis
- **Área do cliente**: Cadastro para acumular pontos e vantagens
- **Reservas online**: Sistema de agendamento de mesas
- **Relatórios avançados**: Análise de desempenho, horários de pico e pratos mais pedidos

## 🛠️ Tecnologias Utilizadas

- Node.js
- Express.js
- Socket.IO (comunicação em tempo real)
- SQLite (banco de dados)
- EJS (templates)
- HTML, CSS, JavaScript (frontend)
- QRCode (geração de códigos QR)

## 📋 Instalação Local

1. **Pré-requisitos**:
   - Node.js (versão 14 ou superior)
   - npm (gerenciador de pacotes)

2. **Clone o repositório**:
   ```bash
   git clone <URL_DO_SEU_REPOSITORIO>
   cd sistema-para-restaurantes
   ```

3. **Instale as dependências**:
   ```bash
   npm install
   ```

4. **Inicie o servidor**:
   ```bash
   npm start
   ```

5. **Acesse o sistema**:
   - Página principal: http://localhost:3000

## 🌐 Deploy em Produção

### Opções de Hospedagem

Devido à natureza do sistema (com servidor Node.js e banco de dados SQLite), recomendamos as seguintes opções de hospedagem:

### 1. Deploy em Plataforma PaaS (Heroku, Railway, Render)

O sistema está configurado para deploy em plataformas PaaS:

- **Heroku**: 
  - Use o Procfile para configuração
  - O SQLite pode apresentar limitações em ambientes stateless
  - Considere usar PostgreSQL para produção

- **Railway**:
  - Configuração semelhante ao Heroku
  - Melhor suporte para bancos de dados persistentes

- **Render**:
  - Fácil configuração de web services
  - Suporte a variáveis de ambiente

### 2. Deploy em VPS ou Servidor Dedicado

Para manter o SQLite e todas as funcionalidades:
- Configure um servidor Linux com Node.js
- Execute o sistema como um serviço systemd
- Configure proxy reverso com Nginx
- Implemente backup e monitoramento

### 3. Configuração para Produção

Para ambientes de produção, considere:

- Substituir SQLite por PostgreSQL ou MySQL
- Configurar variáveis de ambiente para configurações
- Implementar autenticação mais robusta
- Configurar SSL/TLS
- Configurar backup automático remoto

### Configuração do Banco de Dados para Produção

Para produção, recomendamos modificar o servidor para usar PostgreSQL:

```javascript
// Exemplo de configuração para PostgreSQL
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});
```

### Variáveis de Ambiente Recomendadas

```
PORT=3000
DATABASE_URL=postgresql://user:password@host:port/database
NODE_ENV=production
```

### Limitações do SQLite em Produção

- SQLite não é ideal para ambientes com alta concorrência
- Limitações em ambientes stateless (como Heroku)
- Menor segurança comparado a servidores de banco de dados dedicados
- Falta de recursos avançados de backup e replicação

## 📱 Páginas Disponíveis

- **Página Principal**: http://localhost:3000
- **Cardápio Mesa 01**: http://localhost:3000/menu?mesa=01
- **Painel da Cozinha**: http://localhost:3000/kitchen
- **Painel do Administrador**: http://localhost:3000/admin
- **Controle de Estoque**: http://localhost:3000/controle-estoque
- **Cadastro Cliente**: http://localhost:3000/cadastro-cliente
- **Avaliar Pedido**: http://localhost:3000/avaliar-pedido
- **Reservas Online**: http://localhost:3000/reservas
- **QR Code Mesa 01**: http://localhost:3000/qrcode/01

## 🚀 Scripts Disponíveis

- `npm start` - Inicia o servidor principal
- `npm run backup` - Executa backup manual do banco de dados
- `npm run scheduled-backup` - Inicia o serviço de backup automático

## 🔧 Funcionalidades Adicionais

### Clientes
- **Cadastro de clientes**: Área para registro de informações do cliente
- **Sistema de avaliações**: Possibilidade de avaliar pedidos e produtos
- **Acumulo de pontos**: Sistema de fidelidade para clientes cadastrados

### Estoque e Produtos
- **Controle de estoque**: Monitoramento em tempo real de ingredientes e produtos
- **Alerta de estoque baixo**: Notificação quando produtos estão abaixo do nível mínimo
- **Atualização de estoque**: Interface para atualizar quantidades disponíveis

### Reservas e Agendamento
- **Sistema de reservas online**: Agendamento de mesas antecipadamente
- **Gestão de reservas**: Visualização e controle de todas as reservas

### Relatórios e Análises
- **Relatórios de vendas**: Análise detalhada de produtos mais vendidos
- **Análise de horários de pico**: Dados sobre os horários de maior movimento
- **Histórico completo de pedidos**: Armazenamento detalhado de todos os pedidos

### Administração
- **Controle de funcionários**: Níveis de acesso diferenciados
- **Autenticação segura**: Sistema de login para áreas restritas
- **Gestão de permissões**: Controle de acesso a diferentes funcionalidades
- **Sistema de backup automático**: Cópias de segurança regulares do banco de dados

### Backup e Segurança
- **Backup automático**: Sistema de cópias de segurança automáticas
- **Manutenção de backups**: Retenção dos 10 backups mais recentes
- **Backup manual**: Endpoint para backup sob demanda

## 📂 Estrutura do Projeto

```
sistema para restaurantes/
├── public/                 # Arquivos estáticos (CSS, JS, imagens)
│   ├── css/               # Arquivos de estilo
│   ├── js/                # Scripts frontend
│   └── images/            # Imagens
├── views/                 # Templates EJS
├── src/                   # Código-fonte organizado por módulos
├── server_final.js        # Servidor principal com SQLite
├── database.sql           # Script de criação do banco de dados (backup)
├── restaurante.db         # Banco de dados SQLite (criado automaticamente)
├── package.json           # Dependências e scripts
├── README.md             # Documentação
├── DEPLOY.md             # Guia de deploy
├── .env.example          # Modelo de variáveis de ambiente
├── Procfile              # Configuração para Heroku
├── app.json              # Configuração para Heroku
├── netlify.toml          # Configuração para Netlify (frontend apenas)
├── railway.toml          # Configuração para Railway
└── backups/              # Pasta para backups do banco de dados
```

## 🔐 Personalização

Você pode facilmente personalizar:
- Cardápio: Adicione/edite produtos na tabela `produtos`
- Mesas: Configure o número de mesas na tabela `mesas`
- Categorias: Edite as categorias na tabela `categorias`
- Layout: Modifique os arquivos CSS em `/public/css/`

## ©️ Licença

Este projeto é open-source e gratuito para uso.