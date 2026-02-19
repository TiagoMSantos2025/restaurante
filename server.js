const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const QRCode = require('qrcode');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const VOLUME_PATH = process.env.RAILWAY_VOLUME_MOUNT_PATH || './data';
const DB_PATH = path.join(VOLUME_PATH, 'restaurante.db');

// Criar pastas
const pastas = [VOLUME_PATH, './views', './public'];
pastas.forEach(pasta => {
    if (!fs.existsSync(pasta)) fs.mkdirSync(pasta, { recursive: true });
});

// ==================== MIDDLEWARES ====================
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
    secret: 'restaurante_secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// ==================== ROTAS DE TESTE ====================
app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.get('/test', (req, res) => res.send('Servidor funcionando'));

// ==================== BANCO DE DADOS ====================
const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
    // Tabela de restaurantes
    db.run(`CREATE TABLE IF NOT EXISTS restaurantes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL
    )`);

    // Tabela de usuários
    db.run(`CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        restaurante_id INTEGER,
        nome TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        senha TEXT NOT NULL,
        nivel_acesso TEXT DEFAULT 'admin',
        FOREIGN KEY (restaurante_id) REFERENCES restaurantes(id)
    )`);

    // Tabela de mesas
    db.run(`CREATE TABLE IF NOT EXISTS mesas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        restaurante_id INTEGER,
        numero TEXT NOT NULL,
        FOREIGN KEY (restaurante_id) REFERENCES restaurantes(id)
    )`);

    // Inserir dados iniciais se não existirem
    db.get("SELECT * FROM restaurantes WHERE id = 1", (err, row) => {
        if (!row) {
            // Criar restaurante principal
            db.run("INSERT INTO restaurantes (nome, email) VALUES (?, ?)", 
                ['Restaurante Principal', 'principal@email.com']);
            
            // Criar super admin (pode ver todos os restaurantes)
            const senhaSuper = bcrypt.hashSync('super123', 10);
            db.run("INSERT INTO usuarios (restaurante_id, nome, email, senha, nivel_acesso) VALUES (1, ?, ?, ?, ?)",
                ['Super Admin', 'super@admin.com', senhaSuper, 'super_admin']);
            
            // Criar admin do restaurante (vê apenas seu restaurante)
            const senhaAdmin = bcrypt.hashSync('admin123', 10);
            db.run("INSERT INTO usuarios (restaurante_id, nome, email, senha, nivel_acesso) VALUES (1, ?, ?, ?, ?)",
                ['Administrador', 'admin@restaurante.com', senhaAdmin, 'admin']);

            // Criar 12 mesas para o restaurante
            for (let i = 1; i <= 12; i++) {
                db.run("INSERT INTO mesas (restaurante_id, numero) VALUES (1, ?)", 
                    [i.toString().padStart(2, '0')]);
            }
        }
    });
});

// ==================== ROTAS DE AUTENTICAÇÃO ====================

// Página inicial redireciona para login
app.get('/', (req, res) => {
    res.redirect('/login');
});

// Página de login
app.get('/login', (req, res) => {
    // Se já estiver logado, redireciona para o painel correto
    if (req.session.userId) {
        if (req.session.userLevel === 'super_admin') {
            return res.redirect('/super-admin');
        } else {
            return res.redirect('/dashboard');
        }
    }
    res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

// Processar login (POST)
app.post('/login', (req, res) => {
    const { email, senha } = req.body;
    
    db.get(`SELECT u.*, r.nome as restaurante_nome 
            FROM usuarios u
            LEFT JOIN restaurantes r ON u.restaurante_id = r.id
            WHERE u.email = ?`, [email], (err, user) => {
        
        if (!user || !bcrypt.compareSync(senha, user.senha)) {
            // Se erro, volta para login com mensagem
            return res.redirect('/login?erro=1');
        }

        // Salvar dados na sessão
        req.session.userId = user.id;
        req.session.userName = user.nome;
        req.session.userLevel = user.nivel_acesso;
        req.session.restauranteId = user.restaurante_id;
        req.session.restauranteNome = user.restaurante_nome;

        // Redirecionar baseado no nível de acesso
        if (user.nivel_acesso === 'super_admin') {
            res.redirect('/super-admin');
        } else {
            res.redirect('/dashboard');
        }
    });
});

// Logout
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// ==================== MIDDLEWARE DE AUTENTICAÇÃO ====================

function requireAuth(req, res, next) {
    if (!req.session.userId) {
        return res.redirect('/login');
    }
    next();
}

function requireSuperAdmin(req, res, next) {
    if (!req.session.userId) {
        return res.redirect('/login');
    }
    if (req.session.userLevel !== 'super_admin') {
        return res.redirect('/dashboard');
    }
    next();
}

// ==================== ROTAS DO SUPER ADMIN ====================

// Painel do Super Admin
app.get('/super-admin', requireSuperAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'super-admin.html'));
});

// API para listar restaurantes (apenas super admin)
app.get('/api/restaurantes', requireSuperAdmin, (req, res) => {
    db.all('SELECT * FROM restaurantes', [], (err, rows) => {
        res.json(rows || []);
    });
});

// API para criar novo restaurante (apenas super admin)
app.post('/api/restaurantes', requireSuperAdmin, (req, res) => {
    const { nome, email, admin_nome, admin_email, admin_senha } = req.body;
    
    db.run('INSERT INTO restaurantes (nome, email) VALUES (?, ?)', 
        [nome, email], function(err) {
        if (err) return res.json({ success: false });
        
        const restauranteId = this.lastID;
        const senhaHash = bcrypt.hashSync(admin_senha, 10);
        
        // Criar admin do restaurante
        db.run('INSERT INTO usuarios (restaurante_id, nome, email, senha, nivel_acesso) VALUES (?, ?, ?, ?, ?)',
            [restauranteId, admin_nome, admin_email, senhaHash, 'admin']);

        // Criar 12 mesas para o novo restaurante
        for (let i = 1; i <= 12; i++) {
            db.run('INSERT INTO mesas (restaurante_id, numero) VALUES (?, ?)',
                [restauranteId, i.toString().padStart(2, '0')]);
        }
        
        res.json({ success: true, id: restauranteId });
    });
});

// ==================== ROTAS DO ADMIN DO RESTAURANTE ====================

// Dashboard do restaurante
app.get('/dashboard', requireAuth, (req, res) => {
    // Se for super admin tentando acessar dashboard, redireciona
    if (req.session.userLevel === 'super_admin') {
        return res.redirect('/super-admin');
    }
    res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
});

// Página de QR Codes do restaurante
app.get('/qrcodes', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'qrcodes.html'));
});

// API para buscar mesas do restaurante logado
app.get('/api/mesas', requireAuth, (req, res) => {
    db.all('SELECT * FROM mesas WHERE restaurante_id = ? ORDER BY numero', 
        [req.session.restauranteId], (err, rows) => {
        res.json(rows || []);
    });
});

// ==================== ROTAS DE QR CODE ====================

// Gerar QR Code de uma mesa
app.get('/qrcode/:restauranteId/:mesa', async (req, res) => {
    try {
        const restauranteId = req.params.restauranteId;
        const mesa = req.params.mesa;
        const url = `${req.protocol}://${req.get('host')}/menu/${restauranteId}?mesa=${mesa}`;
        
        if (req.query.download === '1') {
            const buffer = await QRCode.toBuffer(url);
            res.setHeader('Content-Disposition', `attachment; filename=mesa-${mesa}.png`);
            res.setHeader('Content-Type', 'image/png');
            return res.send(buffer);
        }
        
        const qrCode = await QRCode.toDataURL(url);
        res.send(`<img src="${qrCode}" style="max-width:300px;">`);
        
    } catch (error) {
        res.status(500).send('Erro ao gerar QR Code');
    }
});

// ==================== ROTAS PÚBLICAS (CLIENTES) ====================

// Cardápio público
app.get('/menu/:restauranteId', (req, res) => {
    const mesa = req.query.mesa || '01';
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Cardápio</title>
            <style>
                body { font-family: Arial; padding: 20px; background: #f5f5f5; }
                .header { background: #667eea; color: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; }
                h1 { margin: 0; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>🍽️ Cardápio Digital</h1>
                <p>Mesa ${mesa}</p>
            </div>
            <p>Cardápio em desenvolvimento. Em breve você poderá fazer pedidos aqui.</p>
        </body>
        </html>
    `);
});

// ==================== INICIAR SERVIDOR ====================

app.listen(PORT, '0.0.0.0', () => {
    console.log('=================================');
    console.log('🚀 SISTEMA DE RESTAURANTE');
    console.log('=================================');
    console.log(`📱 URL: http://localhost:${PORT}`);
    console.log(`🔐 Login: /login`);
    console.log('=================================');
    console.log('👑 Super Admin: super@admin.com / super123');
    console.log('👤 Admin: admin@restaurante.com / admin123');
    console.log('=================================');
});