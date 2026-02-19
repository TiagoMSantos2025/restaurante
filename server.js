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

// Cria a pasta de dados se não existir
if (!fs.existsSync(VOLUME_PATH)) {
    fs.mkdirSync(VOLUME_PATH, { recursive: true });
}

// Dados iniciais do banco
const dadosIniciais = {
    usuarios: [
        {
            id: 1,
            nome: 'Super Admin',
            email: 'super@admin.com',
            senha: bcrypt.hashSync('super123', 10),
            nivel: 'super_admin',
            restauranteId: 1
        },
        {
            id: 2,
            nome: 'Admin',
            email: 'admin@restaurante.com',
            senha: bcrypt.hashSync('admin123', 10),
            nivel: 'admin',
            restauranteId: 1
        }
    ],
    restaurantes: [
        {
            id: 1,
            nome: 'Restaurante Principal',
            email: 'principal@email.com'
        }
    ],
    mesas: [],
    pedidos: []  // <-- NOVO: array para armazenar pedidos
};

// Cria 12 mesas para o restaurante 1
for (let i = 1; i <= 12; i++) {
    dadosIniciais.mesas.push({
        id: i,
        restauranteId: 1,
        numero: i.toString().padStart(2, '0'),
        status: 'disponivel',
        cliente_nome: null,
        valor_total: 0
    });
}

// Função para ler os dados
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

// Função para salvar os dados
function salvarDados(dados) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(dados, null, 2));
        return true;
    } catch (error) {
        console.error('Erro ao salvar dados:', error);
        return false;
    }
}

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'restaurante_secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// Rotas de teste (para health check)
app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.get('/test', (req, res) => res.send('✅ Servidor funcionando'));

// Redireciona a raiz para login
app.get('/', (req, res) => res.redirect('/login'));

// Página de login
app.get('/login', (req, res) => {
    if (req.session.usuarioId) {
        return res.redirect(req.session.nivel === 'super_admin' ? '/super-admin' : '/dashboard');
    }
    res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

// Processa o login
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

    if (usuario.nivel === 'super_admin') {
        res.redirect('/super-admin');
    } else {
        res.redirect('/dashboard');
    }
});

// Logout
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// Middleware de autenticação
function auth(req, res, next) {
    if (!req.session.usuarioId) return res.redirect('/login');
    next();
}

// Página do super admin
app.get('/super-admin', auth, (req, res) => {
    if (req.session.nivel !== 'super_admin') return res.redirect('/dashboard');
    res.sendFile(path.join(__dirname, 'views', 'super-admin.html'));
});

// Dashboard do admin comum
app.get('/dashboard', auth, (req, res) => {
    if (req.session.nivel === 'super_admin') return res.redirect('/super-admin');
    res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
});

// Página de QR Codes (admin comum)
app.get('/qrcodes', auth, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'qrcodes.html'));
});

// ==================== NOVAS ROTAS DE GERENCIAMENTO ====================

app.get('/mesas', auth, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'mesas.html'));
});

app.get('/produtos', auth, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'produtos.html'));
});

app.get('/pedidos', auth, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'pedidos.html'));
});

app.get('/funcionarios', auth, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'funcionarios.html'));
});

app.get('/relatorios', auth, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'relatorios.html'));
});

// ==================== API PARA MESAS ====================

// Listar mesas do restaurante
app.get('/api/mesas', auth, (req, res) => {
    const dados = lerDados();
    const mesas = dados.mesas.filter(m => m.restauranteId === req.session.restauranteId);
    res.json(mesas);
});

// Detalhes de uma mesa (incluindo pedidos)
app.get('/api/mesa/:id', auth, (req, res) => {
    const mesaId = parseInt(req.params.id);
    const dados = lerDados();
    const mesa = dados.mesas.find(m => m.id === mesaId && m.restauranteId === req.session.restauranteId);
    if (!mesa) {
        return res.status(404).json({ error: 'Mesa não encontrada' });
    }
    const pedidos = dados.pedidos.filter(p => p.mesaId === mesaId);
    res.json({ mesa, pedidos });
});

// Fechar conta da mesa
app.post('/api/mesa/:id/fechar', auth, (req, res) => {
    const mesaId = parseInt(req.params.id);
    const { formaPagamento } = req.body;
    const dados = lerDados();
    const mesaIndex = dados.mesas.findIndex(m => m.id === mesaId && m.restauranteId === req.session.restauranteId);
    if (mesaIndex === -1) {
        return res.status(404).json({ error: 'Mesa não encontrada' });
    }
    // Atualizar status da mesa
    dados.mesas[mesaIndex].status = 'disponivel';
    dados.mesas[mesaIndex].cliente_nome = null;
    dados.mesas[mesaIndex].valor_total = 0;
    // Aqui você pode adicionar lógica para registrar no caixa
    if (salvarDados(dados)) {
        res.json({ success: true, mensagem: 'Conta fechada com sucesso' });
    } else {
        res.status(500).json({ error: 'Erro ao salvar' });
    }
});

// ==================== API PARA PEDIDOS ====================

// Criar um novo pedido
app.post('/api/pedidos', auth, (req, res) => {
    const { mesaId, itens, total, observacao } = req.body;
    const dados = lerDados();
    const novoPedido = {
        id: dados.pedidos.length + 1,
        mesaId,
        itens,
        total,
        observacao,
        status: 'pendente',
        data: new Date().toISOString()
    };
    dados.pedidos.push(novoPedido);
    // Atualizar valor da mesa
    const mesaIndex = dados.mesas.findIndex(m => m.id === mesaId);
    if (mesaIndex !== -1) {
        dados.mesas[mesaIndex].valor_total += total;
    }
    if (salvarDados(dados)) {
        res.json({ success: true, id: novoPedido.id });
    } else {
        res.status(500).json({ error: 'Erro ao salvar pedido' });
    }
});

// ==================== ROTAS DE API EXISTENTES ====================

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
    const novoRestaurante = {
        id: dados.restaurantes.length + 1,
        nome,
        email
    };
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
            numero: i.toString().padStart(2, '0'),
            status: 'disponivel',
            cliente_nome: null,
            valor_total: 0
        });
    }
    if (salvarDados(dados)) {
        res.json({ success: true, id: novoRestaurante.id });
    } else {
        res.json({ success: false, error: 'Erro ao salvar' });
    }
});

// ==================== QR CODE ====================

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

// ==================== PÁGINA PÚBLICA DO CARDÁPIO ====================

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

// ==================== INICIAR SERVIDOR ====================

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