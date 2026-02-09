const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const bodyParser = require('body-parser');
const QRCode = require('qrcode');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Criar e conectar ao banco de dados SQLite
const db = new sqlite3.Database('restaurante.db', (err) => {
  if (err) {
    console.error('Erro ao conectar ao banco de dados SQLite:', err);
  } else {
    console.log('Conectado ao banco de dados SQLite');
    
    // Criar tabelas se não existirem
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
      status TEXT DEFAULT 'ativo',
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
  }
});

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Configurar EJS como engine de template
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Rotas
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Rota para a página do cliente com parâmetro de mesa
app.get('/menu', (req, res) => {
  const tableNumber = req.query.mesa || '01';
  res.render('client-menu', { tableNumber });
});

// Rota para o painel da cozinha
app.get('/kitchen', (req, res) => {
  res.render('kitchen-dashboard');
});

// Rota para o painel do caixa
app.get('/admin', (req, res) => {
  res.render('admin-dashboard');
});

// Rotas da API
app.get('/api/products', (req, res) => {
  const sql = `SELECT p.*, c.nome as categoria_nome 
               FROM produtos p 
               LEFT JOIN categorias c ON p.categoria_id = c.id 
               WHERE p.status = 'ativo'`;
  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao buscar produtos' });
      return;
    }
    res.json(rows);
  });
});

app.get('/api/tables', (req, res) => {
  const sql = 'SELECT * FROM mesas ORDER BY numero';
  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao buscar mesas' });
      return;
    }
    res.json(rows);
  });
});

app.get('/api/table-orders/:tableId', (req, res) => {
  const tableId = req.params.tableId;
  const sql = 'SELECT * FROM pedidos WHERE mesa_id = ? AND status != ? ORDER BY hora_pedido DESC';
  db.all(sql, [tableId, 'entregue'], (err, rows) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao buscar pedidos da mesa' });
      return;
    }
    // Parsear os itens do pedido de JSON string
    rows = rows.map(order => {
      order.itens = JSON.parse(order.itens);
      return order;
    });
    res.json(rows);
  });
});

app.post('/api/finalize-order', (req, res) => {
  const { tableId } = req.body;
  const sql = 'UPDATE pedidos SET status = ? WHERE mesa_id = ? AND status != ?';
  db.run(sql, ['entregue', tableId, 'entregue'], function(err) {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao finalizar pedido' });
      return;
    }
    res.json({ success: true, affectedRows: this.changes });
  });
});

app.get('/api/today-stats', (req, res) => {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  
  const sql = `SELECT 
              COUNT(*) as orders,
              COALESCE(SUM(total), 0) as revenue
              FROM pedidos 
              WHERE DATE(hora_pedido) = ? AND status = ?`;
              
  db.get(sql, [todayStr, 'entregue'], (err, row) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao buscar estatísticas' });
      return;
    }
    res.json(row || { orders: 0, revenue: 0 });
  });
});

// Rota para gerar QR Code para uma mesa específica
app.get('/qrcode/:tableNumber', async (req, res) => {
  try {
    const tableNumber = req.params.tableNumber;
    const url = `${req.protocol}://${req.get('host')}/menu?mesa=${tableNumber}`;
    
    const qrCodeDataUrl = await QRCode.toDataURL(url);
    
    // Retorna uma página HTML com o QR Code
    res.send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>QR Code - Mesa ${tableNumber}</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            display: flex; 
            flex-direction: column; 
            align-items: center; 
            justify-content: center; 
            height: 100vh; 
            margin: 0; 
            background-color: #f5f5f5;
          }
          .container { 
            text-align: center; 
            background: white; 
            padding: 30px; 
            border-radius: 10px; 
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
          }
          h1 { color: #2c3e50; }
          .table-number { 
            font-size: 1.5em; 
            font-weight: bold; 
            color: #3498db; 
            margin: 20px 0;
          }
          .qr-code { 
            margin: 20px auto; 
            display: block;
          }
          .scan-text { 
            margin-top: 20px; 
            color: #7f8c8d;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>QR Code para Mesa</h1>
          <div class="table-number">Mesa ${tableNumber}</div>
          <img src="${qrCodeDataUrl}" alt="QR Code" class="qr-code" />
          <p class="scan-text">Aponte sua câmera para este código para acessar o cardápio</p>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Erro ao gerar QR Code:', error);
    res.status(500).json({ error: 'Erro ao gerar QR Code' });
  }
});

// Rota para obter o link direto do QR Code
app.get('/api/qrcode-link/:tableNumber', (req, res) => {
  const tableNumber = req.params.tableNumber;
  const url = `${req.protocol}://${req.get('host')}/menu?mesa=${tableNumber}`;
  res.json({ url: url });
});

// Socket.IO para comunicação em tempo real
io.on('connection', (socket) => {
  console.log('Usuário conectado:', socket.id);

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
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});