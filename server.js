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
    db.run(`CREATE TABLE IF NOT EXISTS restaurantes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        restaurante_id INTEGER,
        nome TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        senha TEXT NOT NULL,
        nivel_acesso TEXT DEFAULT 'admin',
        FOREIGN KEY (restaurante_id) REFERENCES restaurantes(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS mesas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        restaurante_id INTEGER,
        numero TEXT NOT NULL,
        FOREIGN KEY (restaurante_id) REFERENCES restaurantes(id)
    )`);

    // Inserir dados iniciais
    const senhaSuper = bcrypt.hashSync('super123', 10);
    const senhaAdmin = bcrypt.hashSync('admin123', 10);

    db.get("SELECT * FROM restaurantes WHERE id = 1", (err, row) => {
        if (!row) {
            db.run("INSERT INTO restaurantes (nome, email) VALUES (?, ?)", 
                ['Restaurante Principal', 'principal@email.com']);
            
            db.run("INSERT INTO usuarios (restaurante_id, nome, email, senha, nivel_acesso) VALUES (1, ?, ?, ?, ?)",
                ['Super Admin', 'super@admin.com', senhaSuper, 'super_admin']);
            
            db.run("INSERT INTO usuarios (restaurante_id, nome, email, senha, nivel_acesso) VALUES (1, ?, ?, ?, ?)",
                ['Administrador', 'admin@restaurante.com', senhaAdmin, 'admin']);

            for (let i = 1; i <= 12; i++) {
                db.run("INSERT INTO mesas (restaurante_id, numero) VALUES (1, ?)", 
                    [i.toString().padStart(2, '0')]);
            }
        }
    });
});

// ==================== ROTAS DE AUTENTICAÇÃO ====================
app.get('/', (req, res) => res.redirect('/login'));

app.get('/login', (req, res) => {
    if (req.session.userId) {
        return res.redirect(req.session.userLevel === 'super_admin' ? '/super-admin' : '/dashboard');
    }
    res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.post('/api/login', (req, res) => {
    const { email, senha } = req.body;
    
    db.get(`SELECT u.*, r.nome as restaurante_nome 
            FROM usuarios u
            LEFT JOIN restaurantes r ON u.restaurante_id = r.id
            WHERE u.email = ?`, [email], (err, user) => {
        
        if (!user || !bcrypt.compareSync(senha, user.senha)) {
            return res.json({ success: false });
        }

        req.session.userId = user.id;
        req.session.userName = user.nome;
        req.session.userLevel = user.nivel_acesso;
        req.session.restauranteId = user.restaurante_id;

        res.json({ 
            success: true, 
            redirect: user.nivel_acesso === 'super_admin' ? '/super-admin' : '/dashboard'
        });
    });
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// ==================== ROTAS PROTEGIDAS ====================
function requireAuth(req, res, next) {
    if (!req.session.userId) return res.redirect('/login');
    next();
}

function requireSuperAdmin(req, res, next) {
    if (req.session.userLevel !== 'super_admin') return res.redirect('/dashboard');
    next();
}

app.get('/dashboard', requireAuth, (req, res) => {
    if (req.session.userLevel === 'super_admin') return res.redirect('/super-admin');
    res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
});

app.get('/super-admin', requireSuperAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'super-admin.html'));
});

app.get('/qrcodes', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'qrcodes.html'));
});

// ==================== API ====================
app.get('/api/mesas', requireAuth, (req, res) => {
    db.all('SELECT * FROM mesas WHERE restaurante_id = ?', 
        [req.session.restauranteId], (err, rows) => {
        res.json(rows || []);
    });
});

app.get('/api/restaurantes', requireSuperAdmin, (req, res) => {
    db.all('SELECT * FROM restaurantes', [], (err, rows) => {
        res.json(rows || []);
    });
});

app.post('/api/restaurantes', requireSuperAdmin, (req, res) => {
    const { nome, email, admin_nome, admin_email, admin_senha } = req.body;
    
    db.run('INSERT INTO restaurantes (nome, email) VALUES (?, ?)', 
        [nome, email], function(err) {
        if (err) return res.json({ success: false });
        
        const restauranteId = this.lastID;
        const senhaHash = bcrypt.hashSync(admin_senha, 10);
        
        db.run('INSERT INTO usuarios (restaurante_id, nome, email, senha, nivel_acesso) VALUES (?, ?, ?, ?, ?)',
            [restauranteId, admin_nome, admin_email, senhaHash, 'admin']);

        for (let i = 1; i <= 12; i++) {
            db.run('INSERT INTO mesas (restaurante_id, numero) VALUES (?, ?)',
                [restauranteId, i.toString().padStart(2, '0')]);
        }
        
        res.json({ success: true });
    });
});

// ==================== QR CODE ====================
app.get('/qrcode/:restauranteId/:mesa', async (req, res) => {
    const url = `${req.protocol}://${req.get('host')}/menu/${req.params.restauranteId}?mesa=${req.params.mesa}`;
    const qrCode = await QRCode.toDataURL(url);
    
    if (req.query.download === '1') {
        const buffer = await QRCode.toBuffer(url);
        res.setHeader('Content-Disposition', `attachment; filename=mesa-${req.params.mesa}.png`);
        res.setHeader('Content-Type', 'image/png');
        res.send(buffer);
    } else {
        res.send(`<img src="${qrCode}" style="max-width:300px;">`);
    }
});

app.get('/menu/:restauranteId', (req, res) => {
    res.send(`<h1>Cardápio da Mesa ${req.query.mesa}</h1><p>Em desenvolvimento</p>`);
});

// ==================== INICIAR SERVIDOR ====================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`🔐 Login: /login`);
    console.log(`👑 super@admin.com / super123`);
    console.log(`👤 admin@restaurante.com / admin123`);
});