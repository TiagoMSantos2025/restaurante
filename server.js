const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const bcrypt = require('bcrypt');
const QRCode = require('qrcode');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const VOLUME_PATH = process.env.RAILWAY_VOLUME_MOUNT_PATH || './data';
const DATA_FILE = path.join(VOLUME_PATH, 'database.json');

// ==================== INICIALIZAÇÃO ====================
console.log('🚀 Iniciando servidor...');
console.log('📁 Pasta de dados:', VOLUME_PATH);

// Criar pasta de dados se não existir
if (!fs.existsSync(VOLUME_PATH)) {
    fs.mkdirSync(VOLUME_PATH, { recursive: true });
}

// ==================== BANCO DE DADOS EM JSON ====================

// Estrutura inicial do banco
const bancoInicial = {
    restaurantes: [
        {
            id: 1,
            nome: 'Restaurante Principal',
            email: 'principal@email.com'
        }
    ],
    usuarios: [
        {
            id: 1,
            restaurante_id: 1,
            nome: 'Super Admin',
            email: 'super@admin.com',
            senha: bcrypt.hashSync('super123', 10),
            nivel_acesso: 'super_admin'
        },
        {
            id: 2,
            restaurante_id: 1,
            nome: 'Administrador',
            email: 'admin@restaurante.com',
            senha: bcrypt.hashSync('admin123', 10),
            nivel_acesso: 'admin'
        }
    ],
    mesas: []
};

// Criar 12 mesas para o restaurante 1
for (let i = 1; i <= 12; i++) {
    bancoInicial.mesas.push({
        id: i,
        restaurante_id: 1,
        numero: i.toString().padStart(2, '0')
    });
}

// Função para ler o banco
function lerBanco() {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            // Criar arquivo com dados iniciais
            fs.writeFileSync(DATA_FILE, JSON.stringify(bancoInicial, null, 2));
            return bancoInicial;
        }
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Erro ao ler banco:', error);
        return bancoInicial;
    }
}

// Função para salvar o banco
function salvarBanco(dados) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(dados, null, 2));
        return true;
    } catch (error) {
        console.error('Erro ao salvar banco:', error);
        return false;
    }
}

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
app.get('/test', (req, res) => res.send('✅ Servidor funcionando com JSON DB'));

// ==================== ROTAS DE AUTENTICAÇÃO ====================

app.get('/', (req, res) => res.redirect('/login'));

app.get('/login', (req, res) => {
    if (req.session.userId) {
        return res.redirect(req.session.userLevel === 'super_admin' ? '/super-admin' : '/dashboard');
    }
    res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.post('/login', (req, res) => {
    const { email, senha } = req.body;
    const banco = lerBanco();
    
    const user = banco.usuarios.find(u => u.email === email);
    
    if (!user || !bcrypt.compareSync(senha, user.senha)) {
        return res.redirect('/login?erro=1');
    }

    const restaurante = banco.restaurantes.find(r => r.id === user.restaurante_id);

    req.session.userId = user.id;
    req.session.userName = user.nome;
    req.session.userLevel = user.nivel_acesso;
    req.session.restauranteId = user.restaurante_id;
    req.session.restauranteNome = restaurante?.nome || 'Restaurante';

    if (user.nivel_acesso === 'super_admin') {
        res.redirect('/super-admin');
    } else {
        res.redirect('/dashboard');
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// ==================== MIDDLEWARES DE PROTEÇÃO ====================

function requireAuth(req, res, next) {
    if (!req.session.userId) return res.redirect('/login');
    next();
}

function requireSuperAdmin(req, res, next) {
    if (!req.session.userId) return res.redirect('/login');
    if (req.session.userLevel !== 'super_admin') return res.redirect('/dashboard');
    next();
}

// ==================== ROTAS DO SUPER ADMIN ====================

app.get('/super-admin', requireSuperAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'super-admin.html'));
});

app.get('/api/restaurantes', requireSuperAdmin, (req, res) => {
    const banco = lerBanco();
    res.json(banco.restaurantes);
});

app.post('/api/restaurantes', requireSuperAdmin, (req, res) => {
    const { nome, email, admin_nome, admin_email, admin_senha } = req.body;
    const banco = lerBanco();
    
    // Verificar se email já existe
    if (banco.usuarios.find(u => u.email === admin_email)) {
        return res.json({ success: false, error: 'Email já existe' });
    }
    
    // Criar novo restaurante
    const novoRestaurante = {
        id: banco.restaurantes.length + 1,
        nome,
        email
    };
    banco.restaurantes.push(novoRestaurante);
    
    // Criar admin do restaurante
    const novoAdmin = {
        id: banco.usuarios.length + 1,
        restaurante_id: novoRestaurante.id,
        nome: admin_nome,
        email: admin_email,
        senha: bcrypt.hashSync(admin_senha, 10),
        nivel_acesso: 'admin'
    };
    banco.usuarios.push(novoAdmin);
    
    // Criar mesas para o restaurante
    const inicioMesas = banco.mesas.length + 1;
    for (let i = 1; i <= 12; i++) {
        banco.mesas.push({
            id: inicioMesas + i - 1,
            restaurante_id: novoRestaurante.id,
            numero: i.toString().padStart(2, '0')
        });
    }
    
    if (salvarBanco(banco)) {
        res.json({ success: true, id: novoRestaurante.id });
    } else {
        res.json({ success: false, error: 'Erro ao salvar' });
    }
});

// ==================== ROTAS DO ADMIN DO RESTAURANTE ====================

app.get('/dashboard', requireAuth, (req, res) => {
    if (req.session.userLevel === 'super_admin') {
        return res.redirect('/super-admin');
    }
    res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
});

app.get('/qrcodes', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'qrcodes.html'));
});

app.get('/api/mesas', requireAuth, (req, res) => {
    const banco = lerBanco();
    const mesas = banco.mesas.filter(m => m.restaurante_id === req.session.restauranteId);
    res.json(mesas);
});

// ==================== ROTAS DE QR CODE ====================

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

app.get('/qrcodes/:restauranteId', requireSuperAdmin, (req, res) => {
    const restauranteId = parseInt(req.params.restauranteId);
    const banco = lerBanco();
    const restaurante = banco.restaurantes.find(r => r.id === restauranteId);
    
    if (!restaurante) {
        return res.status(404).send('Restaurante não encontrado');
    }
    
    const mesas = banco.mesas.filter(m => m.restaurante_id === restauranteId);
    
    let html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>QR Codes - ${restaurante.nome}</title>
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
            <h1>📱 QR Codes - ${restaurante.nome}</h1>
            <a href="/super-admin" style="color: #667eea;">← Voltar</a>
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

// ==================== ROTAS PÚBLICAS ====================

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
    console.log('🚀 SISTEMA DE RESTAURANTE (JSON DB)');
    console.log('=================================');
    console.log(`📱 URL: http://localhost:${PORT}`);
    console.log(`🔐 Login: /login`);
    console.log('=================================');
    console.log('👑 Super Admin: super@admin.com / super123');
    console.log('👤 Admin: admin@restaurante.com / admin123');
    console.log('=================================');
});