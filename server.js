const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const http = require('http');
const socketIo = require('socket.io');
const QRCode = require('qrcode');
const fs = require('fs');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// ==================== CONFIGURAÇÕES ====================
const isProduction = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 3000;
const VOLUME_PATH = process.env.RAILWAY_VOLUME_MOUNT_PATH || './data';
const DB_PATH = path.join(VOLUME_PATH, 'restaurante.db');

// Criar pastas necessárias
if (!fs.existsSync(VOLUME_PATH)) fs.mkdirSync(VOLUME_PATH, { recursive: true });
if (!fs.existsSync('./views')) fs.mkdirSync('./views');
if (!fs.existsSync('./public')) fs.mkdirSync('./public');
if (!fs.existsSync('./public/uploads')) fs.mkdirSync('./public/uploads');

// ==================== MIDDLEWARES ====================
app.use(cors({ origin: '*', credentials: true }));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: process.env.SESSION_SECRET || 'restaurante_secreto_2024',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: isProduction,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: 'lax'
    }
}));

// ==================== BANCO DE DADOS ====================
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('❌ Erro ao conectar ao banco:', err);
    } else {
        console.log('✅ Conectado ao banco de dados');
        criarTabelas();
    }
});

function criarTabelas() {
    db.serialize(() => {
        // Tabela de funcionários
        db.run(`CREATE TABLE IF NOT EXISTS funcionarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            senha TEXT NOT NULL,
            nivel_acesso TEXT DEFAULT 'operador',
            ativo INTEGER DEFAULT 1
        )`);

        // Tabela de mesas
        db.run(`CREATE TABLE IF NOT EXISTS mesas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            numero TEXT UNIQUE NOT NULL,
            capacidade INTEGER DEFAULT 4,
            status TEXT DEFAULT 'disponivel',
            cliente_nome TEXT,
            cliente_ativo INTEGER DEFAULT 0,
            valor_total REAL DEFAULT 0
        )`);

        // Tabela de categorias
        db.run(`CREATE TABLE IF NOT EXISTS categorias (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            descricao TEXT,
            ordem INTEGER DEFAULT 0,
            ativo INTEGER DEFAULT 1
        )`);

        // Tabela de produtos
        db.run(`CREATE TABLE IF NOT EXISTS produtos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            categoria_id INTEGER,
            nome TEXT NOT NULL,
            descricao TEXT,
            preco REAL NOT NULL,
            ingredientes TEXT,
            imagem TEXT,
            tipo TEXT DEFAULT 'comida',
            destaque INTEGER DEFAULT 0,
            tempo_preparo INTEGER DEFAULT 15,
            ativo INTEGER DEFAULT 1,
            FOREIGN KEY (categoria_id) REFERENCES categorias(id)
        )`);

        // Tabela de pedidos
        db.run(`CREATE TABLE IF NOT EXISTS pedidos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            mesa_id INTEGER,
            cliente_nome TEXT,
            itens TEXT NOT NULL,
            status TEXT DEFAULT 'pendente',
            total REAL NOT NULL,
            observacao TEXT,
            hora_pedido DATETIME DEFAULT CURRENT_TIMESTAMP,
            hora_pronto DATETIME,
            hora_entregue DATETIME,
            FOREIGN KEY (mesa_id) REFERENCES mesas(id)
        )`);

        // Tabela de estoque
        db.run(`CREATE TABLE IF NOT EXISTS estoque (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            produto_id INTEGER UNIQUE,
            quantidade_atual INTEGER DEFAULT 100,
            quantidade_minima INTEGER DEFAULT 10,
            ultima_atualizacao DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (produto_id) REFERENCES produtos(id)
        )`);

        // Tabela de caixa
        db.run(`CREATE TABLE IF NOT EXISTS caixa (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            mesa_id INTEGER,
            valor_total REAL NOT NULL,
            forma_pagamento TEXT,
            data_fechamento DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (mesa_id) REFERENCES mesas(id)
        )`);

        console.log('✅ Tabelas criadas');
        inserirDadosIniciais();
    });
}

function inserirDadosIniciais() {
    // Criar senha do admin
    const senhaAdmin = bcrypt.hashSync('admin123', 10);

    // Inserir admin se não existir
    db.get('SELECT * FROM funcionarios WHERE email = ?', ['admin@restaurante.com'], (err, row) => {
        if (!row) {
            db.run(`INSERT INTO funcionarios (nome, email, senha, nivel_acesso) VALUES (?, ?, ?, ?)`,
                ['Administrador', 'admin@restaurante.com', senhaAdmin, 'admin']);
            console.log('✅ Admin criado');
        }
    });

    // Inserir categorias
    const categorias = [
        ['Entradas', 'Para começar a refeição', 1],
        ['Pratos Principais', 'Principais do cardápio', 2],
        ['Bebidas', 'Bebidas em geral', 3],
        ['Sobremesas', 'Doces e sobremesas', 4]
    ];

    categorias.forEach(([nome, desc, ordem]) => {
        db.run(`INSERT OR IGNORE INTO categorias (nome, descricao, ordem) VALUES (?, ?, ?)`, [nome, desc, ordem]);
    });

    // Inserir produtos
    const produtos = [
        [1, 'Camarão à Milanesa', 'Camarões empanados crocantes', 45.90, 'Camarão, farinha, ovos', 'comida', 1, 20],
        [1, 'Bruschetta', 'Pão italiano com tomate e manjericão', 28.50, 'Pão, tomate, manjericão, azeite', 'comida', 0, 10],
        [2, 'Filé Mignon', 'Filé mignon ao molho madeira', 68.90, 'Filé mignon, molho madeira, batatas', 'comida', 1, 25],
        [2, 'Salmão Grelhado', 'Salmão grelhado com legumes', 72.50, 'Salmão, legumes da estação', 'comida', 1, 20],
        [3, 'Refrigerante', 'Coca-Cola 350ml', 8.00, null, 'bebida', 0, 2],
        [3, 'Suco Natural', 'Suco de laranja 500ml', 12.00, null, 'bebida', 0, 3],
        [3, 'Cerveja', 'Heineken long neck', 10.00, null, 'bebida', 0, 2],
        [4, 'Pudim', 'Pudim de leite condensado', 18.00, 'Leite condensado, ovos, açúcar', 'comida', 1, 10],
        [4, 'Brownie', 'Brownie com sorvete', 22.00, 'Chocolate, nozes, sorvete', 'comida', 1, 12]
    ];

    produtos.forEach(([cat, nome, desc, preco, ing, tipo, dest, tempo]) => {
        db.run(`INSERT OR IGNORE INTO produtos (categoria_id, nome, descricao, preco, ingredientes, tipo, destaque, tempo_preparo) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [cat, nome, desc, preco, ing, tipo, dest, tempo]);
    });

    // Inserir mesas
    for (let i = 1; i <= 12; i++) {
        const num = i.toString().padStart(2, '0');
        db.run(`INSERT OR IGNORE INTO mesas (numero, capacidade) VALUES (?, 4)`, [num]);
    }

    console.log('✅ Dados iniciais inseridos');
}

// ==================== ROTAS DE AUTENTICAÇÃO ====================

// Página inicial - redireciona para login
app.get('/', (req, res) => {
    res.redirect('/login');
});

// Página de login
app.get('/login', (req, res) => {
    if (req.session.userId) {
        return res.redirect('/admin');
    }
    
    const loginPage = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Login - Restaurante</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
            body { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; }
            .login-container { background: white; border-radius: 20px; padding: 40px; width: 100%; max-width: 400px; box-shadow: 0 20px 40px rgba(0,0,0,0.1); }
            h1 { color: #333; text-align: center; margin-bottom: 30px; font-size: 28px; }
            .form-group { margin-bottom: 20px; }
            label { display: block; margin-bottom: 5px; color: #555; font-weight: 500; }
            input { width: 100%; padding: 12px 15px; border: 2px solid #e1e1e1; border-radius: 10px; font-size: 16px; transition: border-color 0.3s; }
            input:focus { outline: none; border-color: #667eea; }
            button { width: 100%; padding: 14px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 10px; font-size: 16px; font-weight: 600; cursor: pointer; transition: transform 0.2s; }
            button:hover { transform: translateY(-2px); }
            .error { background: #fee; color: #c33; padding: 10px; border-radius: 8px; margin-bottom: 20px; text-align: center; }
            .info { text-align: center; margin-top: 20px; color: #999; font-size: 14px; }
        </style>
    </head>
    <body>
        <div class="login-container">
            <h1>🍽️ Sistema Restaurante</h1>
            
            <form method="POST" action="/login">
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" name="email" value="admin@restaurante.com" required>
                </div>
                
                <div class="form-group">
                    <label>Senha</label>
                    <input type="password" name="senha" value="admin123" required>
                </div>
                
                <button type="submit">Entrar</button>
            </form>
            
            <div class="info">
                <p>Email: admin@restaurante.com</p>
                <p>Senha: admin123</p>
            </div>
        </div>
    </body>
    </html>
    `;
    
    res.send(loginPage);
});

// Processar login
app.post('/login', (req, res) => {
    const { email, senha } = req.body;
    
    db.get('SELECT * FROM funcionarios WHERE email = ? AND ativo = 1', [email], (err, user) => {
        if (err) {
            console.error(err);
            return res.redirect('/login?erro=1');
        }
        
        if (!user) {
            return res.redirect('/login?erro=1');
        }
        
        if (!bcrypt.compareSync(senha, user.senha)) {
            return res.redirect('/login?erro=1');
        }
        
        req.session.userId = user.id;
        req.session.userName = user.nome;
        req.session.userLevel = user.nivel_acesso;
        
        res.redirect('/admin');
    });
});

// Logout
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// ==================== ROTAS ADMIN ====================

// Painel admin
app.get('/admin', (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/login');
    }
    
    const adminPage = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Admin - Restaurante</title>
        <style>
            body { font-family: Arial; padding: 20px; background: #f5f5f5; }
            .header { background: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
            h1 { color: #333; margin: 0; }
            .logout { background: #dc3545; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; }
            .menu { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 20px; }
            .card { background: white; padding: 20px; border-radius: 10px; text-align: center; text-decoration: none; color: #333; transition: transform 0.3s; }
            .card:hover { transform: translateY(-5px); box-shadow: 0 10px 20px rgba(0,0,0,0.1); }
            .card span { font-size: 48px; display: block; margin-bottom: 10px; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>👋 Bem-vindo, ${req.session.userName}!</h1>
            <a href="/logout" class="logout">Sair</a>
        </div>
        
        <div class="menu">
            <a href="/qrcodes" class="card">
                <span>📱</span>
                <h3>QR Codes</h3>
                <p>Gerar QR Codes para mesas</p>
            </a>
            <a href="/kitchen" class="card">
                <span>👨‍🍳</span>
                <h3>Cozinha</h3>
                <p>Ver pedidos</p>
            </a>
            <a href="/caixa" class="card">
                <span>💰</span>
                <h3>Caixa</h3>
                <p>Fechar contas</p>
            </a>
            <a href="/qrunico" class="card">
                <span>🔄</span>
                <h3>QR Único</h3>
                <p>Cliente digita a mesa</p>
            </a>
        </div>
    </body>
    </html>
    `;
    
    res.send(adminPage);
});

// Painel cozinha
app.get('/kitchen', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Cozinha</title>
            <style>
                body { font-family: Arial; padding: 20px; background: #1a1a1a; color: white; }
                h1 { color: #ff6b6b; }
            </style>
        </head>
        <body>
            <h1>👨‍🍳 Cozinha - Em desenvolvimento</h1>
            <p><a href="/admin" style="color: white;">Voltar</a></p>
        </body>
        </html>
    `);
});

// Painel caixa
app.get('/caixa', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Caixa</title>
            <style>
                body { font-family: Arial; padding: 20px; background: #f5f5f5; }
                h1 { color: #28a745; }
            </style>
        </head>
        <body>
            <h1>💰 Caixa - Em desenvolvimento</h1>
            <p><a href="/admin">Voltar</a></p>
        </body>
        </html>
    `);
});

// ==================== ROTAS DE QR CODE ====================

// Página com todos os QR Codes
app.get('/qrcodes', (req, res) => {
    let html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Todos os QR Codes</title>
        <style>
            body { font-family: Arial; padding: 20px; background: #f5f5f5; }
            h1 { text-align: center; color: #333; }
            .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 20px; }
            .card { background: white; border-radius: 10px; padding: 20px; text-align: center; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .mesa { font-size: 24px; font-weight: bold; color: #667eea; margin: 10px 0; }
            img { max-width: 200px; margin: 10px 0; }
            .btn { background: #28a745; color: white; padding: 10px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 5px; }
            .back { text-align: center; margin-top: 20px; }
            .back a { color: #667eea; }
        </style>
    </head>
    <body>
        <h1>📱 QR Codes para as Mesas</h1>
        <div class="grid">
    `;
    
    for (let i = 1; i <= 12; i++) {
        const mesa = i.toString().padStart(2, '0');
        html += `
            <div class="card">
                <div class="mesa">Mesa ${mesa}</div>
                <img src="/qrcode/${mesa}" alt="QR Code Mesa ${mesa}" style="max-width: 150px;">
                <br>
                <a href="/qrcode/${mesa}?download=1" class="btn">📥 Baixar</a>
            </div>
        `;
    }
    
    html += `</div><div class="back"><a href="/admin">← Voltar</a></div></body></html>`;
    res.send(html);
});

// Gerar QR Code para uma mesa
app.get('/qrcode/:mesa', async (req, res) => {
    try {
        const mesa = req.params.mesa;
        const url = `${req.protocol}://${req.get('host')}/menu?mesa=${mesa}`;
        
        if (req.query.download === '1') {
            const qrBuffer = await QRCode.toBuffer(url);
            res.setHeader('Content-Disposition', `attachment; filename=qrcode-mesa-${mesa}.png`);
            res.setHeader('Content-Type', 'image/png');
            return res.send(qrBuffer);
        }
        
        const qrCode = await QRCode.toDataURL(url);
        res.send(`<img src="${qrCode}" alt="QR Code Mesa ${mesa}">`);
        
    } catch (error) {
        console.error(error);
        res.status(500).send('Erro ao gerar QR Code');
    }
});

// QR Code único
app.get('/qrunico', async (req, res) => {
    try {
        const url = `${req.protocol}://${req.get('host')}/acesso`;
        const qrCode = await QRCode.toDataURL(url);
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>QR Code Único</title>
                <style>
                    body { font-family: Arial; display: flex; justify-content: center; align-items: center; height: 100vh; background: #f5f5f5; }
                    .container { text-align: center; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                    h1 { color: #333; }
                    img { max-width: 300px; margin: 20px 0; }
                    .btn { background: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 5px; }
                    .back { margin-top: 20px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>📱 QR Code Único</h1>
                    <p>Cliente escaneia e digita o número da mesa</p>
                    <img src="${qrCode}" alt="QR Code Único">
                    <br>
                    <a href="${qrCode}" download="qrcode-unico.png" class="btn">📥 Baixar QR Code</a>
                    <div class="back"><a href="/admin">← Voltar</a></div>
                </div>
            </body>
            </html>
        `);
    } catch (error) {
        console.error(error);
        res.status(500).send('Erro ao gerar QR Code');
    }
});

// Página de acesso do cliente
app.get('/acesso', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Acesso ao Cardápio</title>
            <style>
                body { font-family: Arial; display: flex; justify-content: center; align-items: center; height: 100vh; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
                .container { background: white; padding: 30px; border-radius: 10px; width: 90%; max-width: 400px; }
                h1 { text-align: center; color: #333; }
                .form-group { margin-bottom: 20px; }
                label { display: block; margin-bottom: 5px; color: #555; }
                input { width: 100%; padding: 10px; border: 2px solid #e1e1e1; border-radius: 5px; }
                button { width: 100%; padding: 12px; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🍽️ Bem-vindo!</h1>
                <form method="POST" action="/acesso">
                    <div class="form-group">
                        <label>Número da Mesa</label>
                        <input type="text" name="mesa" placeholder="Ex: 01" required>
                    </div>
                    <div class="form-group">
                        <label>Seu Nome</label>
                        <input type="text" name="nome" placeholder="Digite seu nome" required>
                    </div>
                    <button type="submit">Acessar Cardápio</button>
                </form>
            </div>
        </body>
        </html>
    `);
});

// Processar acesso do cliente
app.post('/acesso', (req, res) => {
    const { mesa, nome } = req.body;
    
    db.get('SELECT * FROM mesas WHERE numero = ?', [mesa], (err, row) => {
        if (err || !row) {
            return res.send(`<script>alert('Mesa não encontrada!');window.location.href='/acesso';</script>`);
        }
        
        db.run('UPDATE mesas SET cliente_nome = ?, cliente_ativo = 1, status = "ocupada" WHERE numero = ?', 
            [nome, mesa]);
        
        res.redirect(`/menu?mesa=${mesa}&nome=${encodeURIComponent(nome)}`);
    });
});

// Cardápio da mesa
app.get('/menu', (req, res) => {
    const mesa = req.query.mesa || '01';
    const nome = req.query.nome || 'Cliente';
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Cardápio - Mesa ${mesa}</title>
            <style>
                body { font-family: Arial; padding: 20px; background: #f8f9fa; }
                .header { background: #667eea; color: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; }
                h1 { margin: 0; }
                .cliente { margin-top: 10px; font-size: 18px; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>🍽️ Cardápio Digital</h1>
                <div class="cliente">Mesa ${mesa} • Olá, ${nome}!</div>
            </div>
            <p>Cardápio em desenvolvimento. Em breve você poderá fazer pedidos aqui.</p>
        </body>
        </html>
    `);
});

// ==================== HEALTH CHECK ====================
app.get('/api/health', (req, res) => {
    res.json({ status: 'online', environment: process.env.NODE_ENV });
});

// ==================== INICIAR SERVIDOR ====================
server.listen(PORT, '0.0.0.0', () => {
    console.log('=================================');
    console.log('🚀 SISTEMA DE RESTAURANTE');
    console.log('=================================');
    console.log(`📱 URL: https://restaurante-production-8b4c.up.railway.app`);
    console.log(`🔐 Login: /login`);
    console.log(`👤 Email: admin@restaurante.com`);
    console.log(`🔑 Senha: admin123`);
    console.log('=================================');
});