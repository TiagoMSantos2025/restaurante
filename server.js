const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

// ==================== CONFIGURAÇÕES DE AMBIENTE ====================
const isProduction = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 3000; // Railway define a PORT

// ==================== CONFIGURAÇÃO DO BANCO DE DADOS ====================
// No Railway, usamos um volume persistente. O caminho é definido pela variável RAILWAY_VOLUME_MOUNT_PATH
const VOLUME_PATH = process.env.RAILWAY_VOLUME_MOUNT_PATH || './data';
const DB_PATH = path.join(VOLUME_PATH, 'restaurante.db');

// Garante que a pasta do banco de dados existe
if (!fs.existsSync(VOLUME_PATH)) {
    fs.mkdirSync(VOLUME_PATH, { recursive: true });
}

// ==================== MIDDLEWARES ====================
app.use(cors({ origin: '*', credentials: true }));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Servir arquivos estáticos (importante para as views e uploads)
app.use(express.static(path.join(__dirname, 'public')));

// Configuração de Sessão (adaptada para produção)
app.use(session({
    secret: process.env.SESSION_SECRET || 'desenvolvimento_secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: isProduction, // true em produção (HTTPS)
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 horas
        sameSite: 'lax'
    }
}));

// ==================== BANCO DE DADOS ====================
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('❌ Erro ao conectar ao banco:', err);
        process.exit(1); // Encerra se não conseguir conectar ao banco
    } else {
        console.log('✅ Conectado ao banco de dados em:', DB_PATH);
        criarTabelasEInserirDados();
    }
});

// Função para criar tabelas e inserir dados iniciais
function criarTabelasEInserirDados() {
    db.serialize(() => {
        // --- Tabelas ---
        db.run(`CREATE TABLE IF NOT EXISTS funcionarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            senha TEXT NOT NULL,
            nivel_acesso TEXT DEFAULT 'operador',
            ativo INTEGER DEFAULT 1
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS mesas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            numero TEXT UNIQUE NOT NULL,
            capacidade INTEGER DEFAULT 4,
            status TEXT DEFAULT 'disponivel',
            cliente_nome TEXT,
            cliente_ativo INTEGER DEFAULT 0,
            valor_total REAL DEFAULT 0
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS categorias (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            descricao TEXT,
            ordem INTEGER DEFAULT 0,
            ativo INTEGER DEFAULT 1
        )`);

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

        db.run(`CREATE TABLE IF NOT EXISTS estoque (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            produto_id INTEGER UNIQUE,
            quantidade_atual INTEGER DEFAULT 100,
            quantidade_minima INTEGER DEFAULT 10,
            ultima_atualizacao DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (produto_id) REFERENCES produtos(id)
        )`);

        console.log('✅ Tabelas verificadas/criadas.');

        // --- Dados Iniciais (opcional, mas útil) ---
        const senhaAdmin = bcrypt.hashSync('admin123', 10);
        db.run(`INSERT OR IGNORE INTO funcionarios (nome, email, senha, nivel_acesso) VALUES (?, ?, ?, ?)`,
            ['Administrador', 'admin@restaurante.com', senhaAdmin, 'admin']);

        // Inserir categorias padrão se não existirem
        const categorias = [
            ['Entradas', 'Para começar a refeição', 1],
            ['Pratos Principais', 'Principais do cardápio', 2],
            ['Bebidas', 'Bebidas em geral', 3],
            ['Sobremesas', 'Doces e sobremesas', 4]
        ];
        categorias.forEach(([nome, desc, ordem]) => {
            db.run(`INSERT OR IGNORE INTO categorias (nome, descricao, ordem) VALUES (?, ?, ?)`, [nome, desc, ordem]);
        });

        // Inserir mesas
        for (let i = 1; i <= 12; i++) {
            const num = i.toString().padStart(2, '0');
            db.run(`INSERT OR IGNORE INTO mesas (numero, capacidade) VALUES (?, 4)`, [num]);
        }

        console.log('✅ Dados iniciais inseridos/verificados.');
    });
}

// ==================== ROTAS (API e Views) ====================

// Rota de teste para verificar se o servidor está online
app.get('/api/health', (req, res) => {
    res.json({ status: 'online', environment: process.env.NODE_ENV });
});

// Suas outras rotas (login, admin, cardapio, etc.) vêm aqui...
// (Cole abaixo as rotas que você já tinha, como /login, /admin, /api/produtos, etc.)
// --- EXEMPLO MÍNIMO PARA COMEÇAR ---
app.get('/', (req, res) => {
    res.send('🚀 Servidor do Restaurante está online! Acesse /login para a área administrativa.');
});

app.get('/login', (req, res) => {
    res.send('<h1>Página de Login</h1><p>Em construção...</p>');
});

app.get('/kitchen', (req, res) => {
    res.send('<h1>Painel da Cozinha</h1><p>Em construção...</p>');
});
// --- FIM DO EXEMPLO MÍNIMO ---

// ==================== INICIAR SERVIDOR ====================
server.listen(PORT, '0.0.0.0', () => { // Importante: ouvir em 0.0.0.0
    console.log('=================================');
    console.log(`🚀 SISTEMA DE RESTAURANTE`);
    console.log('=================================');
    console.log(`🌍 Ambiente: ${process.env.NODE_ENV || 'desenvolvimento'}`);
    console.log(`📱 URL: http://localhost:${PORT}`);
    console.log(`🔗 Rota de saúde: /api/health`);
    console.log('=================================');
});