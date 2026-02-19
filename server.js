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

// ==================== CONFIGURAÇÕES DE AMBIENTE ====================
const isProduction = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 3000;

// ==================== CONFIGURAÇÃO DO BANCO DE DADOS ====================
const VOLUME_PATH = process.env.RAILWAY_VOLUME_MOUNT_PATH || './data';
const DB_PATH = path.join(VOLUME_PATH, 'restaurante.db');

if (!fs.existsSync(VOLUME_PATH)) {
    fs.mkdirSync(VOLUME_PATH, { recursive: true });
}

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
        process.exit(1);
    } else {
        console.log('✅ Conectado ao banco de dados em:', DB_PATH);
        criarTabelasEInserirDados();
    }
});

function criarTabelasEInserirDados() {
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

        console.log('✅ Tabelas verificadas/criadas.');

        // Inserir admin padrão
        const senhaAdmin = bcrypt.hashSync('admin123', 10);
        db.run(`INSERT OR IGNORE INTO funcionarios (nome, email, senha, nivel_acesso) VALUES (?, ?, ?, ?)`,
            ['Administrador', 'admin@restaurante.com', senhaAdmin, 'admin']);

        // Inserir categorias padrão
        const categorias = [
            ['Entradas', 'Para começar a refeição', 1],
            ['Pratos Principais', 'Principais do cardápio', 2],
            ['Bebidas', 'Bebidas em geral', 3],
            ['Sobremesas', 'Doces e sobremesas', 4]
        ];
        categorias.forEach(([nome, desc, ordem]) => {
            db.run(`INSERT OR IGNORE INTO categorias (nome, descricao, ordem) VALUES (?, ?, ?)`, [nome, desc, ordem]);
        });

        // Inserir produtos padrão
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

        console.log('✅ Dados iniciais inseridos/verificados.');
    });
}

// ==================== ROTAS PÚBLICAS ====================

// Página inicial - AGORA REDIRECIONA PARA LOGIN
app.get('/', (req, res) => {
    res.redirect('/login');
});

// Página de login
app.get('/login', (req, res) => {
    if (req.session.userId) {
        return res.redirect('/admin');
    }
    res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.post('/login', (req, res) => {
    const { email, senha } = req.body;
    
    db.get('SELECT * FROM funcionarios WHERE email = ? AND ativo = 1', [email], (err, user) => {
        if (err || !user || !bcrypt.compareSync(senha, user.senha)) {
            return res.send(`<script>alert('Email ou senha inválidos!');window.location.href='/login';</script>`);
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

// Painel admin principal
app.get('/admin', (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/login');
    }
    res.sendFile(path.join(__dirname, 'views', 'admin.html'));
});

// Painel da cozinha
app.get('/kitchen', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'kitchen.html'));
});

// Painel do caixa
app.get('/caixa', (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/login');
    }
    res.sendFile(path.join(__dirname, 'views', 'caixa.html'));
});

// ==================== ROTAS DE CLIENTE ====================

// Cardápio da mesa (cliente)
app.get('/menu', (req, res) => {
    const mesa = req.query.mesa || '01';
    res.sendFile(path.join(__dirname, 'views', 'menu.html'));
});

// Página onde cliente digita a mesa
app.get('/acesso', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'acesso.html'));
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
        
        req.session.cliente = { mesa, nome };
        res.redirect(`/menu?mesa=${mesa}&nome=${encodeURIComponent(nome)}`);
    });
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
        </style>
    </head>
    <body>
        <h1>📱 QR Codes para as Mesas</h1>
        <div class="grid">
    `;
    
    for (let i = 1; i <= 12; i++) {
        const mesa = i.toString().padStart(2, '0');
        const url = `${req.protocol}://${req.get('host')}/menu?mesa=${mesa}`;
        const qrUrl = `${req.protocol}://${req.get('host')}/qrcode/${mesa}`;
        
        html += `
            <div class="card">
                <div class="mesa">Mesa ${mesa}</div>
                <img src="${qrUrl}" alt="QR Code Mesa ${mesa}" style="max-width: 150px;">
                <br>
                <a href="${qrUrl}" target="_blank" class="btn">🔗 Ver QR Code</a>
                <a href="${qrUrl}?download=1" class="btn" style="background: #667eea;">📥 Baixar</a>
            </div>
        `;
    }
    
    html += `</div></body></html>`;
    res.send(html);
});

// Gerar QR Code para uma mesa específica
app.get('/qrcode/:mesa', async (req, res) => {
    try {
        const mesa = req.params.mesa;
        const url = `${req.protocol}://${req.get('host')}/menu?mesa=${mesa}`;
        const qrCode = await QRCode.toDataURL(url);
        
        // Se for para download
        if (req.query.download === '1') {
            const qrBuffer = await QRCode.toBuffer(url);
            res.setHeader('Content-Disposition', `attachment; filename=qrcode-mesa-${mesa}.png`);
            res.setHeader('Content-Type', 'image/png');
            return res.send(qrBuffer);
        }
        
        // Se for para visualizar
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>QR Code - Mesa ${mesa}</title>
                <style>
                    body { font-family: Arial; display: flex; justify-content: center; align-items: center; height: 100vh; background: #f5f5f5; }
                    .container { text-align: center; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                    h1 { color: #333; }
                    .mesa { font-size: 24px; color: #667eea; margin: 10px 0; }
                    img { max-width: 300px; margin: 20px 0; }
                    .btn { background: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 5px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>📱 QR Code Mesa ${mesa}</h1>
                    <img src="${qrCode}" alt="QR Code Mesa ${mesa}">
                    <br>
                    <a href="?download=1" class="btn">📥 Baixar QR Code</a>
                    <br>
                    <p style="margin-top: 20px; color: #666;">Link: ${url}</p>
                </div>
            </body>
            </html>
        `);
    } catch (error) {
        console.error(error);
        res.status(500).send('Erro ao gerar QR Code');
    }
});

// QR Code único (cliente digita a mesa)
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
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>📱 QR Code Único</h1>
                    <p>Cliente escaneia e digita o número da mesa</p>
                    <img src="${qrCode}" alt="QR Code Único">
                    <br>
                    <a href="${qrCode}" download="qrcode-unico.png" class="btn">📥 Baixar QR Code</a>
                </div>
            </body>
            </html>
        `);
    } catch (error) {
        console.error(error);
        res.status(500).send('Erro ao gerar QR Code');
    }
});

// ==================== API ====================

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'online', environment: process.env.NODE_ENV });
});

// Buscar produtos
app.get('/api/produtos', (req, res) => {
    db.all('SELECT * FROM produtos WHERE ativo = 1', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Buscar pedidos ativos
app.get('/api/pedidos/ativos', (req, res) => {
    const sql = `
        SELECT p.*, m.numero as mesa_numero 
        FROM pedidos p 
        JOIN mesas m ON p.mesa_id = m.id 
        WHERE p.status IN ('pendente', 'preparando', 'pronto')
    `;
    
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        rows.forEach(r => r.itens = JSON.parse(r.itens));
        res.json(rows);
    });
});

// Criar pedido
app.post('/api/pedidos', (req, res) => {
    const { mesa, cliente_nome, itens, total, observacao } = req.body;
    
    db.get('SELECT id FROM mesas WHERE numero = ?', [mesa], (err, mesaRow) => {
        if (err || !mesaRow) return res.status(404).json({ error: 'Mesa não encontrada' });
        
        db.run(
            `INSERT INTO pedidos (mesa_id, cliente_nome, itens, total, observacao) 
             VALUES (?, ?, ?, ?, ?)`,
            [mesaRow.id, cliente_nome, JSON.stringify(itens), total, observacao],
            function(err) {
                if (err) return res.status(500).json({ error: err.message });
                
                db.run('UPDATE mesas SET valor_total = valor_total + ? WHERE id = ?', [total, mesaRow.id]);
                
                io.emit('novo_pedido', { id: this.lastID, mesa, cliente: cliente_nome, itens, total });
                res.json({ success: true, id: this.lastID });
            }
        );
    });
});

// Atualizar status do pedido
app.put('/api/pedidos/:id/status', (req, res) => {
    const { status } = req.body;
    
    db.run('UPDATE pedidos SET status = ? WHERE id = ?', [status, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        io.emit('pedido_atualizado', { id: req.params.id, status });
        res.json({ success: true });
    });
});

// Fechar mesa (caixa)
app.post('/api/mesas/:id/fechar', (req, res) => {
    const { forma_pagamento } = req.body;
    const mesaId = req.params.id;
    
    db.get('SELECT * FROM mesas WHERE id = ?', [mesaId], (err, mesa) => {
        if (err || !mesa) return res.status(404).json({ error: 'Mesa não encontrada' });
        
        db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            
            // Registrar no caixa
            db.run('INSERT INTO caixa (mesa_id, valor_total, forma_pagamento) VALUES (?, ?, ?)',
                [mesaId, mesa.valor_total, forma_pagamento]);
            
            // Limpar mesa
            db.run('UPDATE mesas SET status = "disponivel", cliente_nome = NULL, valor_total = 0, cliente_ativo = 0 WHERE id = ?', [mesaId]);
            
            // Finalizar pedidos
            db.run('UPDATE pedidos SET status = "entregue", hora_entregue = CURRENT_TIMESTAMP WHERE mesa_id = ? AND status IN ("pendente", "preparando", "pronto")', [mesaId]);
            
            db.run('COMMIT', (err) => {
                if (err) {
                    console.error(err);
                    return res.status(500).json({ error: 'Erro ao fechar mesa' });
                }
                
                io.emit('mesa_fechada', { mesaId });
                res.json({ success: true });
            });
        });
    });
});

// ==================== SOCKET.IO ====================

io.on('connection', (socket) => {
    console.log('🔌 Cliente conectado:', socket.id);
    
    socket.on('join_kitchen', () => {
        socket.join('kitchen');
    });
    
    socket.on('join_admin', () => {
        socket.join('admin');
    });
});

// ==================== INICIAR SERVIDOR ====================

server.listen(PORT, '0.0.0.0', () => {
    console.log('=================================');
    console.log('🚀 SISTEMA DE RESTAURANTE');
    console.log('=================================');
    console.log(`🌍 Ambiente: ${process.env.NODE_ENV || 'desenvolvimento'}`);
    console.log(`📱 URL: http://localhost:${PORT}`);
    console.log(`🔐 Login: /login`);
    console.log(`👨‍🍳 Cozinha: /kitchen`);
    console.log(`💰 Caixa: /caixa`);
    console.log(`📱 QR Codes: /qrcodes`);
    console.log('=================================');
});