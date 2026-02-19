import express from 'express';
import session from 'express-session';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import QRCode from 'qrcode';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const VOLUME_PATH = process.env.RAILWAY_VOLUME_MOUNT_PATH || './data';
const DATA_FILE = path.join(VOLUME_PATH, 'database.json');

if (!fs.existsSync(VOLUME_PATH)) {
    fs.mkdirSync(VOLUME_PATH, { recursive: true });
}

const dadosIniciais = {
    usuarios: [
        { id: 1, nome: 'Super Admin', email: 'super@admin.com', senha: bcrypt.hashSync('super123', 10), nivel: 'super_admin', restauranteId: 1 },
        { id: 2, nome: 'Admin', email: 'admin@restaurante.com', senha: bcrypt.hashSync('admin123', 10), nivel: 'admin', restauranteId: 1 }
    ],
    restaurantes: [ { id: 1, nome: 'Restaurante Principal', email: 'principal@email.com' } ],
    mesas: []
};

for (let i = 1; i <= 12; i++) {
    dadosIniciais.mesas.push({ id: i, restauranteId: 1, numero: i.toString().padStart(2, '0') });
}

function lerDados() {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            fs.writeFileSync(DATA_FILE, JSON.stringify(dadosIniciais, null, 2));
            return dadosIniciais;
        }
        return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (error) {
        console.error('Erro ao ler dados:', error);
        return dadosIniciais;
    }
}

function salvarDados(dados) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(dados, null, 2));
        return true;
    } catch (error) {
        console.error('Erro ao salvar dados:', error);
        return false;
    }
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'restaurante_secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.get('/test', (req, res) => res.send('✅ Servidor funcionando'));
app.get('/', (req, res) => res.redirect('/login'));

app.get('/login', (req, res) => {
    if (req.session.usuarioId) {
        return res.redirect(req.session.nivel === 'super_admin' ? '/super-admin' : '/dashboard');
    }
    res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.post('/login', (req, res) => {
    const { email, senha } = req.body;
    const dados = lerDados();
    const usuario = dados.usuarios.find(u => u.email === email);
    if (!usuario || !bcrypt.compareSync(senha, usuario.senha)) {
        return res.redirect('/login?erro=1');
    }
    req.session.usuarioId = usuario.id;
    req.session.nome = usuario.nome;
    req.session.nivel = usuario.nivel;
    req.session.restauranteId = usuario.restauranteId;
    res.redirect(usuario.nivel === 'super_admin' ? '/super-admin' : '/dashboard');
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

function auth(req, res, next) {
    if (!req.session.usuarioId) return res.redirect('/login');
    next();
}

app.get('/super-admin', auth, (req, res) => {
    if (req.session.nivel !== 'super_admin') return res.redirect('/dashboard');
    res.sendFile(path.join(__dirname, 'views', 'super-admin.html'));
});

app.get('/dashboard', auth, (req, res) => {
    if (req.session.nivel === 'super_admin') return res.redirect('/super-admin');
    res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
});

app.get('/qrcodes', auth, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'qrcodes.html'));
});

app.get('/api/mesas', auth, (req, res) => {
    const dados = lerDados();
    const mesas = dados.mesas.filter(m => m.restauranteId === req.session.restauranteId);
    res.json(mesas);
});

app.get('/api/restaurantes', auth, (req, res) => {
    if (req.session.nivel !== 'super_admin') return res.status(403).json({ error: 'Acesso negado' });
    const dados = lerDados();
    res.json(dados.restaurantes);
});

app.post('/api/restaurantes', auth, (req, res) => {
    if (req.session.nivel !== 'super_admin') return res.status(403).json({ error: 'Acesso negado' });
    const { nome, email, admin_nome, admin_email, admin_senha } = req.body;
    const dados = lerDados();
    if (dados.usuarios.find(u => u.email === admin_email)) {
        return res.json({ success: false, error: 'Email já existe' });
    }
    const novoRestaurante = { id: dados.restaurantes.length + 1, nome, email };
    dados.restaurantes.push(novoRestaurante);
    const novoAdmin = {
        id: dados.usuarios.length + 1,
        restauranteId: novoRestaurante.id,
        nome: admin_nome,
        email: admin_email,
        senha: bcrypt.hashSync(admin_senha, 10),
        nivel: 'admin'
    };
    dados.usuarios.push(novoAdmin);
    for (let i = 1; i <= 12; i++) {
        dados.mesas.push({
            id: dados.mesas.length + 1,
            restauranteId: novoRestaurante.id,
            numero: i.toString().padStart(2, '0')
        });
    }
    if (salvarDados(dados)) res.json({ success: true, id: novoRestaurante.id });
    else res.json({ success: false, error: 'Erro ao salvar' });
});

app.get('/qrcode/:restauranteId/:mesa', async (req, res) => {
    try {
        const url = `${req.protocol}://${req.get('host')}/menu/${req.params.restauranteId}?mesa=${req.params.mesa}`;
        if (req.query.download === '1') {
            const buffer = await QRCode.toBuffer(url);
            res.setHeader('Content-Disposition', `attachment; filename=mesa-${req.params.mesa}.png`);
            res.setHeader('Content-Type', 'image/png');
            return res.send(buffer);
        }
        const qrCode = await QRCode.toDataURL(url);
        res.send(`<img src="${qrCode}" style="max-width:300px;">`);
    } catch (error) {
        res.status(500).send('Erro ao gerar QR Code');
    }
});

app.get('/menu/:restauranteId', (req, res) => {
    res.send(`
        <html>
        <body style="font-family: Arial; padding: 20px;">
            <h1>🍽️ Cardápio Digital</h1>
            <p>Mesa: ${req.query.mesa || '01'}</p>
            <p>Cardápio em desenvolvimento...</p>
        </body>
        </html>
    `);
});

app.listen(PORT, '0.0.0.0', () => {
    console.log('=================================');
    console.log('🚀 SISTEMA DE RESTAURANTE');
    console.log('=================================');
    console.log(`📱 URL: http://localhost:${PORT}`);
    console.log(`🔐 Login: /login`);
    console.log('=================================');
    console.log('👑 super@admin.com / super123');
    console.log('👤 admin@restaurante.com / admin123');
    console.log('=================================');
});