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
const pastas = [
    VOLUME_PATH,
    './views',
    './public',
    './public/uploads',
    './public/qrcodes',
    './logs'
];

pastas.forEach(pasta => {
    if (!fs.existsSync(pasta)) {
        fs.mkdirSync(pasta, { recursive: true });
        console.log(`📁 Pasta criada: ${pasta}`);
    }
});

// ==================== MIDDLEWARES ====================
app.use(cors({ origin: '*', credentials: true }));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: process.env.SESSION_SECRET || 'super_secret_multirestaurante_2024',
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
        console.log('✅ Conectado ao banco de dados');
        criarTabelas();
    }
});

function criarTabelas() {
    db.serialize(() => {
        // Tabela de restaurantes
        db.run(`CREATE TABLE IF NOT EXISTS restaurantes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            telefone TEXT,
            endereco TEXT,
            logo TEXT,
            ativo INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Tabela de usuários (funcionários de cada restaurante)
        db.run(`CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            restaurante_id INTEGER NOT NULL,
            nome TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            senha TEXT NOT NULL,
            nivel_acesso TEXT DEFAULT 'operador',
            ativo INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (restaurante_id) REFERENCES restaurantes(id)
        )`);

        // Tabela de mesas
        db.run(`CREATE TABLE IF NOT EXISTS mesas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            restaurante_id INTEGER NOT NULL,
            numero TEXT NOT NULL,
            capacidade INTEGER DEFAULT 4,
            status TEXT DEFAULT 'disponivel',
            cliente_nome TEXT,
            cliente_ativo INTEGER DEFAULT 0,
            valor_total REAL DEFAULT 0,
            qrcode_path TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (restaurante_id) REFERENCES restaurantes(id),
            UNIQUE(restaurante_id, numero)
        )`);

        // Tabela de categorias
        db.run(`CREATE TABLE IF NOT EXISTS categorias (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            restaurante_id INTEGER NOT NULL,
            nome TEXT NOT NULL,
            descricao TEXT,
            ordem INTEGER DEFAULT 0,
            ativo INTEGER DEFAULT 1,
            FOREIGN KEY (restaurante_id) REFERENCES restaurantes(id)
        )`);

        // Tabela de produtos
        db.run(`CREATE TABLE IF NOT EXISTS produtos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            restaurante_id INTEGER NOT NULL,
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
            FOREIGN KEY (restaurante_id) REFERENCES restaurantes(id),
            FOREIGN KEY (categoria_id) REFERENCES categorias(id)
        )`);

        // Tabela de pedidos
        db.run(`CREATE TABLE IF NOT EXISTS pedidos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            restaurante_id INTEGER NOT NULL,
            mesa_id INTEGER,
            cliente_nome TEXT,
            itens TEXT NOT NULL,
            status TEXT DEFAULT 'pendente',
            total REAL NOT NULL,
            observacao TEXT,
            hora_pedido DATETIME DEFAULT CURRENT_TIMESTAMP,
            hora_pronto DATETIME,
            hora_entregue DATETIME,
            FOREIGN KEY (restaurante_id) REFERENCES restaurantes(id),
            FOREIGN KEY (mesa_id) REFERENCES mesas(id)
        )`);

        // Tabela de caixa
        db.run(`CREATE TABLE IF NOT EXISTS caixa (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            restaurante_id INTEGER NOT NULL,
            mesa_id INTEGER,
            valor_total REAL NOT NULL,
            forma_pagamento TEXT,
            data_fechamento DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (restaurante_id) REFERENCES restaurantes(id),
            FOREIGN KEY (mesa_id) REFERENCES mesas(id)
        )`);

        // Tabela de logs
        db.run(`CREATE TABLE IF NOT EXISTS logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            restaurante_id INTEGER,
            usuario_id INTEGER,
            acao TEXT NOT NULL,
            descricao TEXT,
            ip TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (restaurante_id) REFERENCES restaurantes(id),
            FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
        )`);

        console.log('✅ Tabelas criadas');
        criarDadosIniciais();
    });
}

function criarDadosIniciais() {
    // Verificar se já existem dados
    db.get('SELECT COUNT(*) as count FROM restaurantes', [], (err, row) => {
        if (err || row.count > 0) return;

        console.log('📦 Criando dados iniciais...');

        // Criar restaurante principal
        db.run(`INSERT INTO restaurantes (nome, email, telefone, endereco) VALUES (?, ?, ?, ?)`,
            ['Restaurante Principal', 'contato@principal.com', '(11) 99999-9999', 'Rua Principal, 123'],
            function(err) {
                if (err) return;
                
                const restauranteId = this.lastID;

                // Criar super admin
                const senhaSuper = bcrypt.hashSync('super123', 10);
                db.run(`INSERT INTO usuarios (restaurante_id, nome, email, senha, nivel_acesso) VALUES (?, ?, ?, ?, ?)`,
                    [restauranteId, 'Super Admin', 'super@admin.com', senhaSuper, 'super_admin']);

                // Criar admin do restaurante
                const senhaAdmin = bcrypt.hashSync('admin123', 10);
                db.run(`INSERT INTO usuarios (restaurante_id, nome, email, senha, nivel_acesso) VALUES (?, ?, ?, ?, ?)`,
                    [restauranteId, 'Administrador', 'admin@restaurante.com', senhaAdmin, 'admin']);

                // Criar mesas
                for (let i = 1; i <= 12; i++) {
                    const num = i.toString().padStart(2, '0');
                    db.run(`INSERT INTO mesas (restaurante_id, numero, capacidade) VALUES (?, ?, 4)`,
                        [restauranteId, num]);
                }

                // Criar categorias
                const categorias = [
                    ['Entradas', 'Para começar a refeição', 1],
                    ['Pratos Principais', 'Principais do cardápio', 2],
                    ['Bebidas', 'Bebidas em geral', 3],
                    ['Sobremesas', 'Doces e sobremesas', 4]
                ];

                categorias.forEach(([nome, desc, ordem]) => {
                    db.run(`INSERT INTO categorias (restaurante_id, nome, descricao, ordem) VALUES (?, ?, ?, ?)`,
                        [restauranteId, nome, desc, ordem]);
                });

                // Criar produtos
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

                produtos.forEach(([catId, nome, desc, preco, ing, tipo, dest, tempo]) => {
                    db.run(`INSERT INTO produtos (restaurante_id, categoria_id, nome, descricao, preco, ingredientes, tipo, destaque, tempo_preparo) 
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [restauranteId, catId, nome, desc, preco, ing, tipo, dest, tempo]);
                });

                console.log('✅ Dados iniciais criados com sucesso!');
            });
    });
}

// ==================== FUNÇÕES AUXILIARES ====================

function registrarLog(usuarioId, restauranteId, acao, descricao, req) {
    const ip = req?.ip || req?.connection?.remoteAddress || 'desconhecido';
    
    db.run(`INSERT INTO logs (restaurante_id, usuario_id, acao, descricao, ip) VALUES (?, ?, ?, ?, ?)`,
        [restauranteId, usuarioId, acao, descricao, ip]);
}

// ==================== MIDDLEWARES DE AUTENTICAÇÃO ====================

function requireAuth(req, res, next) {
    if (!req.session.userId) {
        return res.redirect('/login');
    }
    next();
}

function requireSuperAdmin(req, res, next) {
    if (!req.session.userId || req.session.userLevel !== 'super_admin') {
        return res.redirect('/dashboard');
    }
    next();
}

function requireAdmin(req, res, next) {
    if (!req.session.userId || !['super_admin', 'admin'].includes(req.session.userLevel)) {
        return res.redirect('/dashboard');
    }
    next();
}

// ==================== ROTAS PÚBLICAS ====================

// Página inicial
app.get('/', (req, res) => {
    res.redirect('/login');
});

// Página de login
app.get('/login', (req, res) => {
    if (req.session.userId) {
        return res.redirect(req.session.userLevel === 'super_admin' ? '/super-admin' : '/dashboard');
    }
    res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

// API de login
app.post('/api/login', (req, res) => {
    const { email, senha } = req.body;
    
    db.get(`
        SELECT u.*, r.nome as restaurante_nome, r.id as restaurante_id 
        FROM usuarios u
        JOIN restaurantes r ON u.restaurante_id = r.id
        WHERE u.email = ? AND u.ativo = 1
    `, [email], (err, user) => {
        if (err || !user || !bcrypt.compareSync(senha, user.senha)) {
            return res.json({ success: false });
        }
        
        req.session.userId = user.id;
        req.session.userName = user.nome;
        req.session.userLevel = user.nivel_acesso;
        req.session.restauranteId = user.restaurante_id;
        req.session.restauranteNome = user.restaurante_nome;
        
        registrarLog(user.id, user.restaurante_id, 'LOGIN', 'Login realizado', req);
        
        res.json({ 
            success: true, 
            redirect: user.nivel_acesso === 'super_admin' ? '/super-admin' : '/dashboard',
            user: {
                nome: user.nome,
                nivel: user.nivel_acesso,
                restaurante: user.restaurante_nome
            }
        });
    });
});

// Logout
app.get('/logout', (req, res) => {
    if (req.session.userId) {
        registrarLog(req.session.userId, req.session.restauranteId, 'LOGOUT', 'Logout realizado', req);
    }
    req.session.destroy();
    res.redirect('/login');
});

// ==================== ROTAS DO SUPER ADMIN ====================

// Painel do Super Admin
app.get('/super-admin', requireSuperAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'super-admin.html'));
});

// API para listar restaurantes
app.get('/api/restaurantes', requireSuperAdmin, (req, res) => {
    db.all('SELECT * FROM restaurantes ORDER BY id', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// API para criar restaurante
app.post('/api/restaurantes', requireSuperAdmin, (req, res) => {
    const { nome, email, telefone, endereco, admin_nome, admin_email, admin_senha } = req.body;
    
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        // Criar restaurante
        db.run(`INSERT INTO restaurantes (nome, email, telefone, endereco) VALUES (?, ?, ?, ?)`,
            [nome, email, telefone, endereco], function(err) {
                if (err) {
                    db.run('ROLLBACK');
                    return res.status(500).json({ error: err.message });
                }
                
                const restauranteId = this.lastID;
                
                // Criar admin do restaurante
                const senhaHash = bcrypt.hashSync(admin_senha, 10);
                db.run(`INSERT INTO usuarios (restaurante_id, nome, email, senha, nivel_acesso) VALUES (?, ?, ?, ?, ?)`,
                    [restauranteId, admin_nome, admin_email, senhaHash, 'admin'], function(err) {
                        if (err) {
                            db.run('ROLLBACK');
                            return res.status(500).json({ error: err.message });
                        }
                        
                        // Criar mesas (12 mesas)
                        for (let i = 1; i <= 12; i++) {
                            const num = i.toString().padStart(2, '0');
                            db.run(`INSERT INTO mesas (restaurante_id, numero, capacidade) VALUES (?, ?, 4)`,
                                [restauranteId, num]);
                        }
                        
                        // Criar categorias padrão
                        const categorias = [
                            ['Entradas', 'Para começar a refeição', 1],
                            ['Pratos Principais', 'Principais do cardápio', 2],
                            ['Bebidas', 'Bebidas em geral', 3],
                            ['Sobremesas', 'Doces e sobremesas', 4]
                        ];
                        
                        categorias.forEach(([nome, desc, ordem]) => {
                            db.run(`INSERT INTO categorias (restaurante_id, nome, descricao, ordem) VALUES (?, ?, ?, ?)`,
                                [restauranteId, nome, desc, ordem]);
                        });
                        
                        db.run('COMMIT', (err) => {
                            if (err) {
                                db.run('ROLLBACK');
                                return res.status(500).json({ error: err.message });
                            }
                            
                            registrarLog(req.session.userId, req.session.restauranteId, 
                                'CRIAR_RESTAURANTE', `Criou restaurante: ${nome}`, req);
                            
                            res.json({ success: true, id: restauranteId });
                        });
                    });
            });
    });
});

// ==================== ROTAS DO ADMIN/RESTAURANTE ====================

// Dashboard do restaurante
app.get('/dashboard', requireAuth, (req, res) => {
    if (req.session.userLevel === 'super_admin') {
        return res.redirect('/super-admin');
    }
    res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
});

// Página de QR Codes
app.get('/qrcodes', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'qrcodes.html'));
});

// API para buscar mesas do restaurante
app.get('/api/mesas', requireAuth, (req, res) => {
    db.all('SELECT * FROM mesas WHERE restaurante_id = ? ORDER BY numero', 
        [req.session.restauranteId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// API para estatísticas do dashboard
app.get('/api/stats', requireAuth, (req, res) => {
    const restauranteId = req.session.restauranteId;
    const today = new Date().toISOString().split('T')[0];
    
    db.get('SELECT COUNT(*) as count FROM mesas WHERE restaurante_id = ? AND status = "ocupada"', 
        [restauranteId], (err, mesas) => {
        
        db.get('SELECT COUNT(*) as count FROM pedidos WHERE restaurante_id = ? AND DATE(hora_pedido) = ?', 
            [restauranteId, today], (err, pedidos) => {
            
            db.get('SELECT COALESCE(SUM(total), 0) as total FROM pedidos WHERE restaurante_id = ? AND DATE(hora_pedido) = ? AND status = "entregue"', 
                [restauranteId, today], (err, fat) => {
                
                db.get('SELECT COUNT(*) as count FROM usuarios WHERE restaurante_id = ? AND ativo = 1', 
                    [restauranteId], (err, func) => {
                    
                    res.json({
                        mesas: mesas?.count || 0,
                        pedidos: pedidos?.count || 0,
                        faturamento: fat?.total || 0,
                        funcionarios: func?.count || 0
                    });
                });
            });
        });
    });
});

// ==================== ROTAS DE QR CODE ====================

// Página de QR Codes do restaurante
app.get('/qrcodes/:restauranteId?', requireAuth, (req, res) => {
    const restauranteId = req.params.restauranteId || req.session.restauranteId;
    
    // Verificar permissão
    if (req.session.userLevel !== 'super_admin' && restauranteId != req.session.restauranteId) {
        return res.status(403).send('Acesso negado');
    }
    
    db.all('SELECT * FROM mesas WHERE restaurante_id = ? ORDER BY numero', [restauranteId], (err, mesas) => {
        if (err) return res.status(500).send('Erro ao carregar mesas');
        
        let html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>QR Codes</title>
            <style>
                body { font-family: Arial; padding: 20px; background: #f5f5f5; }
                h1 { text-align: center; color: #333; }
                .header { background: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
                .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 20px; }
                .card { background: white; border-radius: 10px; padding: 20px; text-align: center; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                .mesa { font-size: 24px; font-weight: bold; color: #667eea; margin: 10px 0; }
                img { max-width: 200px; margin: 10px 0; }
                .btn { background: #28a745; color: white; padding: 10px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 5px; }
                .back { text-align: center; margin-top: 20px; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>📱 QR Codes</h1>
                <a href="/dashboard" style="color: #667eea;">← Voltar</a>
            </div>
            <div class="grid">
        `;
        
        mesas.forEach(mesa => {
            html += `
                <div class="card">
                    <div class="mesa">Mesa ${mesa.numero}</div>
                    <img src="/qrcode/${restauranteId}/${mesa.numero}" alt="QR Code">
                    <br>
                    <a href="/qrcode/${restauranteId}/${mesa.numero}?download=1" class="btn">📥 Baixar</a>
                </div>
            `;
        });
        
        html += `</div></body></html>`;
        res.send(html);
    });
});

// Gerar QR Code
app.get('/qrcode/:restauranteId/:mesa', async (req, res) => {
    try {
        const { restauranteId, mesa } = req.params;
        const url = `${req.protocol}://${req.get('host')}/menu/${restauranteId}?mesa=${mesa}`;
        
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

// ==================== ROTAS DO CLIENTE ====================

// Página de acesso do cliente (digitar mesa)
app.get('/acesso/:restauranteId?', (req, res) => {
    const restauranteId = req.params.restauranteId || 1;
    
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
                <form method="POST" action="/acesso/${restauranteId}">
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
app.post('/acesso/:restauranteId', (req, res) => {
    const restauranteId = req.params.restauranteId;
    const { mesa, nome } = req.body;
    
    db.get('SELECT * FROM mesas WHERE restaurante_id = ? AND numero = ?', 
        [restauranteId, mesa], (err, row) => {
        if (err || !row) {
            return res.send(`<script>alert('Mesa não encontrada!');window.location.href='/acesso/${restauranteId}';</script>`);
        }
        
        db.run('UPDATE mesas SET cliente_nome = ?, cliente_ativo = 1, status = "ocupada" WHERE id = ?', 
            [nome, row.id]);
        
        res.redirect(`/menu/${restauranteId}?mesa=${mesa}&nome=${encodeURIComponent(nome)}`);
    });
});

// Cardápio do cliente
app.get('/menu/:restauranteId', (req, res) => {
    const restauranteId = req.params.restauranteId;
    const mesa = req.query.mesa || '01';
    const nome = req.query.nome || 'Cliente';
    
    db.get('SELECT nome FROM restaurantes WHERE id = ?', [restauranteId], (err, rest) => {
        const restauranteNome = rest?.nome || 'Restaurante';
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Cardápio - ${restauranteNome}</title>
                <style>
                    body { font-family: Arial; padding: 20px; background: #f8f9fa; }
                    .header { background: #667eea; color: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; }
                    h1 { margin: 0; }
                    .cliente { margin-top: 10px; font-size: 18px; }
                    .restaurante { font-size: 14px; opacity: 0.9; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🍽️ ${restauranteNome}</h1>
                    <div class="restaurante">Cardápio Digital</div>
                    <div class="cliente">Mesa ${mesa} • Olá, ${nome}!</div>
                </div>
                <p>Cardápio em desenvolvimento. Em breve você poderá fazer pedidos aqui.</p>
            </body>
            </html>
        `);
    });
});

// ==================== HEALTH CHECK ====================

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'online', 
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString()
    });
});

// ==================== INICIAR SERVIDOR ====================

server.listen(PORT, '0.0.0.0', () => {
    console.log('=================================');
    console.log('🚀 MULTIRESTAURANTE SYSTEM');
    console.log('=================================');
    console.log(`📱 URL: https://restaurante-production-8b4c.up.railway.app`);
    console.log(`🔐 Login: /login`);
    console.log(`👑 Super Admin: super@admin.com / super123`);
    console.log(`🏢 Admin: admin@restaurante.com / admin123`);
    console.log('=================================');
});