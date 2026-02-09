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

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

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
        cliente_id INTEGER,
        avaliacao_pedido INTEGER,
        comentario_avaliacao TEXT,
        FOREIGN KEY (mesa_id) REFERENCES mesas(id),
        FOREIGN KEY (cliente_id) REFERENCES clientes(id)
      )`);
      
      db.run(`CREATE TABLE IF NOT EXISTS clientes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT,
        email TEXT UNIQUE,
        telefone TEXT,
        pontos INTEGER DEFAULT 0,
        data_registro DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);
      
      db.run(`CREATE TABLE IF NOT EXISTS avaliacoes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pedido_id INTEGER,
        produto_id INTEGER,
        nota INTEGER CHECK(nota >= 1 AND nota <= 5),
        comentario TEXT,
        data_avaliacao DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (pedido_id) REFERENCES pedidos(id),
        FOREIGN KEY (produto_id) REFERENCES produtos(id)
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
    });
  });
}

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

// Rota para cadastro de cliente
app.get('/cadastro-cliente', (req, res) => {
  res.render('customer-register');
});

// Rota para avaliação de pedido
app.get('/avaliar-pedido', (req, res) => {
  res.render('order-review');
});

// Rota para controle de estoque
app.get('/controle-estoque', (req, res) => {
  res.render('stock-control');
});

// Rota para sistema de reservas
app.get('/reservas', (req, res) => {
  res.render('booking-system');
});

// Rotas da API
app.get('/api/products', (req, res) => {
  const sql = `SELECT p.*, c.nome as categoria_nome, s.quantidade_atual as estoque_atual
               FROM produtos p 
               LEFT JOIN categorias c ON p.categoria_id = c.id 
               LEFT JOIN estoque s ON p.id = s.produto_id
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

// Rota para registrar cliente
app.post('/api/clientes', (req, res) => {
  const { nome, email, telefone } = req.body;
  const sql = 'INSERT INTO clientes (nome, email, telefone) VALUES (?, ?, ?)';
  db.run(sql, [nome, email, telefone], function(err) {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao registrar cliente' });
      return;
    }
    res.json({ success: true, id: this.lastID });
  });
});

// Rota para registrar avaliação de pedido
app.post('/api/avaliar-pedido', (req, res) => {
  const { pedido_id, avaliacao, comentario } = req.body;
  const sql = 'UPDATE pedidos SET avaliacao_pedido = ?, comentario_avaliacao = ? WHERE id = ?';
  db.run(sql, [avaliacao, comentario, pedido_id], function(err) {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao registrar avaliação' });
      return;
    }
    res.json({ success: true, affectedRows: this.changes });
  });
});

// Rota para registrar avaliação de produto
app.post('/api/avaliar-produto', (req, res) => {
  const { pedido_id, produto_id, nota, comentario } = req.body;
  const sql = 'INSERT INTO avaliacoes (pedido_id, produto_id, nota, comentario) VALUES (?, ?, ?, ?)';
  db.run(sql, [pedido_id, produto_id, nota, comentario], function(err) {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao registrar avaliação de produto' });
      return;
    }
    res.json({ success: true, id: this.lastID });
  });
});

// Rota para atualizar estoque
app.put('/api/estoque/atualizar', (req, res) => {
  const { produto_id, quantidade } = req.body;
  const sql = `INSERT OR REPLACE INTO estoque (produto_id, quantidade_atual, ultima_atualizacao) 
              VALUES (?, ?, CURRENT_TIMESTAMP)`;
  db.run(sql, [produto_id, quantidade], function(err) {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao atualizar estoque' });
      return;
    }
    res.json({ success: true });
  });
});

// Rota para verificar estoque baixo
app.get('/api/estoque/baixo', (req, res) => {
  const sql = `SELECT p.nome, s.quantidade_atual, s.quantidade_minima 
               FROM estoque s 
               JOIN produtos p ON s.produto_id = p.id 
               WHERE s.quantidade_atual <= s.quantidade_minima`;
  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao verificar estoque baixo' });
      return;
    }
    res.json(rows);
  });
});

// Rota para criar reserva
app.post('/api/reservas', (req, res) => {
  const { cliente_id, mesa_id, data_reserva, pessoas, observacoes } = req.body;
  const sql = 'INSERT INTO reservas (cliente_id, mesa_id, data_reserva, pessoas, observacoes) VALUES (?, ?, ?, ?, ?)';
  db.run(sql, [cliente_id, mesa_id, data_reserva, pessoas, observacoes], function(err) {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao criar reserva' });
      return;
    }
    res.json({ success: true, id: this.lastID });
  });
});

// Rota para obter reservas
app.get('/api/reservas', (req, res) => {
  const sql = `SELECT r.*, c.nome as cliente_nome, m.numero as mesa_numero 
               FROM reservas r 
               JOIN clientes c ON r.cliente_id = c.id 
               JOIN mesas m ON r.mesa_id = m.id 
               WHERE r.status = 'ativa' 
               ORDER BY r.data_reserva`;
  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao buscar reservas' });
      return;
    }
    res.json(rows);
  });
});

// Rota para relatório de vendas
app.get('/api/relatorios/vendas', (req, res) => {
  const { data_inicio, data_fim } = req.query;
  let sql = `SELECT p.*, SUM(JSON_EXTRACT(i.value, '$.quantity')) as quantidade_vendida, 
                    SUM(JSON_EXTRACT(i.value, '$.quantity') * JSON_EXTRACT(i.value, '$.price')) as total_vendido
             FROM pedidos p 
             JOIN json_each(p.itens) AS i 
             WHERE p.status = 'entregue'`;
  
  const params = [];
  if (data_inicio) {
    sql += ' AND DATE(p.hora_pedido) >= ?';
    params.push(data_inicio);
  }
  if (data_fim) {
    sql += ' AND DATE(p.hora_pedido) <= ?';
    params.push(data_fim);
  }
  
  sql += ` GROUP BY JSON_EXTRACT(i.value, '$.id') 
           ORDER BY quantidade_vendida DESC`;
  
  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao gerar relatório de vendas' });
      return;
    }
    res.json(rows);
  });
});

// Rota para login de funcionário
app.post('/api/login', (req, res) => {
  const { email, senha } = req.body;
  const sql = 'SELECT id, nome, email, nivel_acesso FROM funcionarios WHERE email = ? AND senha = ? AND ativo = 1';
  db.get(sql, [email, senha], (err, row) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro no login' });
      return;
    }
    if (row) {
      res.json({ success: true, user: row });
    } else {
      res.status(401).json({ error: 'Credenciais inválidas' });
    }
  });
});

// Rota para backup manual do banco de dados
app.get('/api/backup', (req, res) => {
  const { createBackup } = require('./backup-db');
  
  createBackup();
  
  res.json({ success: true, message: 'Backup iniciado com sucesso' });
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

// Iniciar servidor após inicializar o banco de dados
initializeDatabase();

// Esperar um pouco para garantir que o banco de dados esteja pronto
setTimeout(() => {
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
  });
}, 1000);
