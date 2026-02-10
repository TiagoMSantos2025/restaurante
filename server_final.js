const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const bodyParser = require('body-parser');
const QRCode = require('qrcode');
const sqlite3 = require('sqlite3').verbose();
const session = require('express-session');
const bcrypt = require('bcrypt');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Configuração de sessão
app.use(session({
    secret: 'restaurante-secreto-2024',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, // true se estiver usando HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 24 horas
    }
}));

// Configurar EJS como engine de template
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

let db;

// Inicializar o banco de dados
function initializeDatabase() {
  db = new sqlite3.Database('restaurante.db', (err) => {
    if (err) {
      console.error('Erro ao conectar ao banco de dados SQLite:', err);
      return;
    }
    console.log('Conectado ao banco de dados SQLite');
    
    // Criar tabelas se não existirem
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS mesas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        numero TEXT NOT NULL UNIQUE,
        capacidade INTEGER DEFAULT 4,
        status TEXT DEFAULT 'disponivel',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS categorias (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        descricao TEXT,
        status TEXT DEFAULT 'ativo'
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS produtos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        descricao TEXT,
        preco REAL NOT NULL,
        categoria_id INTEGER,
        imagem TEXT,
        ingredientes TEXT,
        tipo TEXT DEFAULT 'comida', -- comida ou bebida
        status TEXT DEFAULT 'ativo',
        estoque INTEGER DEFAULT 100,
        FOREIGN KEY (categoria_id) REFERENCES categorias(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS pedidos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mesa_id INTEGER,
        itens TEXT NOT NULL,  -- Armazenar como JSON string
        status TEXT DEFAULT 'pendente',
        hora_pedido DATETIME DEFAULT CURRENT_TIMESTAMP,
        hora_inicio_preparo DATETIME,
        hora_finalizacao DATETIME,
        total REAL,
        avaliacao_pedido INTEGER,
        comentario_avaliacao TEXT,
        FOREIGN KEY (mesa_id) REFERENCES mesas(id)
      )`);
      

      
      db.run(`CREATE TABLE IF NOT EXISTS estoque (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        produto_id INTEGER,
        quantidade_atual INTEGER,
        quantidade_minima INTEGER DEFAULT 10,
        ultima_atualizacao DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (produto_id) REFERENCES produtos(id)
      )`);
      
      db.run(`CREATE TABLE IF NOT EXISTS funcionarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        senha TEXT NOT NULL,
        nivel_acesso TEXT DEFAULT 'operacional', -- operacional, gerente, admin
        ativo BOOLEAN DEFAULT 1
      )`);
      
      db.run(`CREATE TABLE IF NOT EXISTS reservas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cliente_id INTEGER,
        mesa_id INTEGER,
        data_reserva DATETIME NOT NULL,
        pessoas INTEGER DEFAULT 2,
        status TEXT DEFAULT 'ativa',
        observacoes TEXT,
        FOREIGN KEY (cliente_id) REFERENCES clientes(id),
        FOREIGN KEY (mesa_id) REFERENCES mesas(id)
      )`);

      // Inserir categorias padrão se não existirem
      db.run("INSERT OR IGNORE INTO categorias (nome, descricao) VALUES ('Entradas', 'Pratos iniciais para abrir o apetite')");
      db.run("INSERT OR IGNORE INTO categorias (nome, descricao) VALUES ('Pratos Principais', 'Pratos principais do cardápio')");
      db.run("INSERT OR IGNORE INTO categorias (nome, descricao) VALUES ('Bebidas', 'Bebidas alcoólicas e não alcoólicas')");
      db.run("INSERT OR IGNORE INTO categorias (nome, descricao) VALUES ('Sobremesas', 'Doces e sobremesas para finalizar a refeição')");

      // Inserir alguns produtos de exemplo
      db.run("INSERT OR IGNORE INTO produtos (nome, descricao, preco, categoria_id) VALUES ('Camarão àgil', 'Camarões grelhados com alho e ervas', 35.00, 1)");
      db.run("INSERT OR IGNORE INTO produtos (nome, descricao, preco, categoria_id) VALUES ('Salada Caesar', 'Salada com frango grelhado, croutons e molho Caesar', 28.00, 1)");
      db.run("INSERT OR IGNORE INTO produtos (nome, descricao, preco, categoria_id) VALUES ('Filé Mignon', 'Filé mignon grelhado com batatas sauté', 65.00, 2)");
      db.run("INSERT OR IGNORE INTO produtos (nome, descricao, preco, categoria_id) VALUES ('Frango Grelhado', 'Peito de frango grelhado com legumes', 42.00, 2)");
      db.run("INSERT OR IGNORE INTO produtos (nome, descricao, preco, categoria_id) VALUES ('Refrigerante', 'Refrigerante lata 350ml', 8.00, 3)");
      db.run("INSERT OR IGNORE INTO produtos (nome, descricao, preco, categoria_id) VALUES ('Suco Natural', 'Suco de laranja natural 500ml', 12.00, 3)");
      db.run("INSERT OR IGNORE INTO produtos (nome, descricao, preco, categoria_id) VALUES ('Pudim', 'Pudim de leite condensado tradicional', 15.00, 4)");
      db.run("INSERT OR IGNORE INTO produtos (nome, descricao, preco, categoria_id) VALUES ('Brownie', 'Brownie com sorvete de baunilha', 18.00, 4)");

      // Inserir algumas mesas
      for (let i = 1; i <= 10; i++) {
        const num = i.toString().padStart(2, '0');
        db.run(`INSERT OR IGNORE INTO mesas (numero, capacidade) VALUES ('${num}', 4)`);
      }
      
      // Inserir usuário administrador padrão
      db.run(`INSERT OR IGNORE INTO funcionarios (nome, email, senha, nivel_acesso) 
              VALUES ('Administrador', 'admin@restaurante.com', 'admin123', 'admin')`);
    });
  });
}

// Middleware de autenticação
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  next();
}

// Rota principal - vai direto para login
app.get('/', (req, res) => {
    res.redirect('/login');
});

// Rota para login
app.get('/login', (req, res) => {
  // Se já estiver logado, redireciona para admin
  if (req.session.userId) {
    return res.redirect('/admin');
  }
  res.render('login');
});

// Rota para painel administrativo (balcão)
app.get('/admin', requireAuth, (req, res) => {
  res.render('admin-dashboard-modern', { 
    userName: req.session.userName,
    userLevel: req.session.userLevel 
  });
});

// Rota para cozinha
app.get('/kitchen', (req, res) => {
  res.render('kitchen-dashboard');
});

// Rota para estoque
app.get('/estoque', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'inventory.html'));
});

// Rota para delivery
app.get('/delivery', (req, res) => {
  res.sendFile(path.join(__dirname, 'delivery', 'index.html'));
});

// Rota para o painel do balcão
app.get('/counter', (req, res) => {
  res.render('counter-dashboard');
});

// Socket.IO para comunicação em tempo real
io.on('connection', (socket) => {
  console.log('Usuário conectado:', socket.id);

  // Junta o socket a uma sala específica
  socket.on('join_room', (room) => {
    socket.join(room);
    console.log(`Socket ${socket.id} entrou na sala: ${room}`);
  });

  socket.on('disconnect', () => {
    console.log('Usuário desconectado:', socket.id);
  });

  // Receber novo pedido do cliente
  socket.on('novo_pedido', (pedido) => {
    // Primeiro, encontrar o ID da mesa pelo número
    const mesaSql = 'SELECT id FROM mesas WHERE numero = ?';
    db.get(mesaSql, [pedido.mesa], (err, mesaRow) => {
      if (err) {
        console.error(err);
        return;
      }
      
      if (!mesaRow) {
        console.error(`Mesa ${pedido.mesa} não encontrada`);
        return;
      }
      
      // Obter o tipo de cada item do pedido
      const itemIds = pedido.itens.map(item => item.id).join(',');
      const produtoSql = `SELECT id, tipo FROM produtos WHERE id IN (${itemIds})`;
      
      db.all(produtoSql, [], (err, produtos) => {
        if (err) {
          console.error(err);
          return;
        }
        
        // Associar o tipo a cada item do pedido
        pedido.itens = pedido.itens.map(item => {
          const produto = produtos.find(p => p.id === item.id);
          return {
            ...item,
            tipo: produto ? produto.tipo : 'comida' // Padrão para comida se não encontrado
          };
        });
        
        // Salvar no banco de dados com status 'pendente'
        const sql = 'INSERT INTO pedidos (mesa_id, itens, status, total) VALUES (?, ?, ?, ?)';
        const itensJson = JSON.stringify(pedido.itens);
        db.run(sql, [mesaRow.id, itensJson, 'pendente', pedido.total], function(err) {
          if (err) {
            console.error(err);
            return;
          }
          
          // Emitir para todos os clientes conectados
          io.emit('pedido_atualizado', {
            id: this.lastID,
            mesa: pedido.mesa,
            itens: pedido.itens,
            status: 'pendente',
            hora_pedido: new Date()
          });
          
          // Emitir notificação específica para cozinha ou balcão
          const temComida = pedido.itens.some(item => item.tipo === 'comida');
          const temBebida = pedido.itens.some(item => item.tipo === 'bebida');
          
          if (temComida) {
            io.to('cozinha').emit('novo_pedido_cozinha', {
              id: this.lastID,
              mesa: pedido.mesa,
              itens: pedido.itens.filter(item => item.tipo === 'comida'),
              status: 'pendente',
              hora_pedido: new Date()
            });
          }
          
          if (temBebida) {
            io.to('balcao').emit('novo_pedido_bebida', {
              id: this.lastID,
              mesa: pedido.mesa,
              itens: pedido.itens.filter(item => item.tipo === 'bebida'),
              status: 'pendente',
              hora_pedido: new Date()
            });
          }
        });
      });
    });
  });

  // Receber atualização de status do pedido
  socket.on('atualizar_status', (dados) => {
    const sql = 'UPDATE pedidos SET status = ? WHERE id = ?';
    db.run(sql, [dados.status, dados.id], function(err) {
      if (err) {
        console.error(err);
        return;
      }
      
      // Emitir para todos os clientes conectados
      io.emit('pedido_atualizado', dados);
    });
  });

  // Obter pedidos para o painel da cozinha
  socket.on('obter_pedidos', () => {
    const sql = `SELECT p.id, p.status, p.hora_pedido, m.numero as mesa, p.itens
                 FROM pedidos p
                 JOIN mesas m ON p.mesa_id = m.id
                 WHERE p.status != ?
                 ORDER BY p.hora_pedido ASC`;
    db.all(sql, ['entregue'], (err, rows) => {
      if (err) {
        console.error(err);
        return;
      }
      
      // Parsear os itens do pedido de JSON string
      rows = rows.map(order => {
        order.itens = JSON.parse(order.itens);
        return order;
      });
      
      socket.emit('pedidos_atualizados', rows);
    });
  });

  // Obter pedidos de bebidas para o balcão
  socket.on('obter_pedidos_bebidas', () => {
    const sql = `SELECT p.id, p.status, p.hora_pedido, m.numero as mesa, p.itens
                 FROM pedidos p
                 JOIN mesas m ON p.mesa_id = m.id
                 WHERE p.status != ?
                 ORDER BY p.hora_pedido ASC`;
    db.all(sql, ['entregue'], (err, rows) => {
      if (err) {
        console.error(err);
        return;
      }
      
      // Parsear os itens do pedido de JSON string
      rows = rows.map(order => {
        order.itens = JSON.parse(order.itens);
        return order;
      }).filter(order => {
        // Filtrar apenas pedidos que contenham bebidas
        return order.itens.some(item => item.tipo === 'bebida');
      });
      
      socket.emit('pedidos_bebidas_atualizados', rows);
    });
  });
});

// Iniciar servidor após inicializar o banco de dados
initializeDatabase();

// Esperar um pouco para garantir que o banco de dados esteja pronto
setTimeout(() => {
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
  });
}, 1000);
