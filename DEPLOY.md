# Guia de Deploy para Produção

Este guia explica como implantar o sistema de restaurante em diferentes plataformas de hospedagem.

## 🚨 Importante sobre SQLite

Este sistema foi desenvolvido usando SQLite como banco de dados. Isso apresenta limitações para ambientes de produção, especialmente em plataformas como Heroku que têm sistemas de arquivos efêmeros. Para produção, recomendamos fortemente migrar para PostgreSQL ou MySQL.

## 🛠️ Opções de Deploy

### 1. Heroku (Recomendado com PostgreSQL)

#### Passos:

1. Faça fork deste repositório
2. Crie uma conta no [Heroku](https://heroku.com)
3. Instale o [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli)
4. Execute os comandos:

```bash
heroku login
heroku create seu-app-nome
heroku addons:create heroku-postgresql:hobby-dev
git push heroku main
```

5. Acesse seu app em `https://seu-app-nome.herokuapp.com`

#### Configuração do Banco de Dados:

O sistema detectará automaticamente o banco de dados PostgreSQL quando a variável `DATABASE_URL` estiver presente.

### 2. Railway

#### Passos:

1. Crie uma conta no [Railway](https://railway.app)
2. Conecte seu repositório GitHub
3. Selecione o projeto
4. Adicione um serviço PostgreSQL
5. Configure as variáveis de ambiente:

```
DATABASE_URL=postgresql://user:password@host:port/database
NODE_ENV=production
PORT=8080
```

6. Faça deploy automaticamente

### 3. Render

#### Passos:

1. Crie uma conta no [Render](https://render.com)
2. Crie um novo Web Service
3. Conecte seu repositório GitHub
4. Configure como:

- Environment: Node
- Build Command: `npm install`
- Start Command: `npm start`
- Environment Variables: Adicione DATABASE_URL para PostgreSQL

### 4. VPS ou Servidor Dedicado

#### Configuração Recomendada:

1. Clone o repositório no servidor
2. Instale Node.js e PM2:

```bash
curl -sL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs
npm install -g pm2
```

3. Instale as dependências:

```bash
npm install
```

4. Inicie o aplicativo com PM2:

```bash
pm2 start server_final.js --name "restaurant-system"
pm2 startup
pm2 save
```

5. Configure Nginx como proxy reverso:

```nginx
server {
    listen 80;
    server_name seu-dominio.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 🔧 Migração de Banco de Dados

### De SQLite para PostgreSQL

Se estiver migrando de SQLite para PostgreSQL, você precisará:

1. Exportar os dados do SQLite
2. Adaptar o código para usar PostgreSQL
3. Atualizar a conexão no servidor

Exemplo de código para PostgreSQL:

```javascript
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Usar pool.query() em vez de db.run() ou db.all()
```

## 🚀 Variáveis de Ambiente Recomendadas

```
PORT=3000
NODE_ENV=production
DATABASE_URL=postgresql://user:password@host:port/database
```

## 🔒 Considerações de Segurança

- Nunca commite chaves ou senhas no repositório
- Use variáveis de ambiente para configurações sensíveis
- Configure SSL/TLS para conexões
- Implemente autenticação adequada para painéis administrativos

## 📊 Monitoramento

Considere adicionar serviços de monitoramento como:
- LogRocket para logs de usuário
- New Relic ou DataDog para monitoramento de desempenho
- Sentry para rastreamento de erros

## 🔄 Backup

Para ambientes de produção, configure backup automático:
- PostgreSQL: pg_dump
- Heroku: heroku pg:backups
- Railway: Configuração automática de backups

## ⚠️ Limitações Conhecidas

- SQLite não é recomendado para ambientes de produção com alta carga
- Alguns recursos podem não funcionar corretamente em ambientes stateless
- WebSocket pode ter limitações em alguns proxies reversos

---

Siga este guia para implantar com sucesso o sistema em sua plataforma de escolha!