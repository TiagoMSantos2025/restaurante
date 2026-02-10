// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Rota para favicon
app.get('/favicon.ico', (req, res) => {
  res.status(204); // No Content
});

// Rota para a página do cliente com parâmetro de mesa (versão simplificada)
app.get('/menu', (req, res) => {
  const tableNumber = req.query.mesa || '01';
  res.render('client-menu-simple', { tableNumber });
});

// Rota para o novo cardápio do cliente
app.get('/cardapio', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'client-menu.html'));
});

// Rota para o painel de controle de estoque
app.get('/controle-estoque', (req, res) => {
  res.render('stock-control');
});

// Rota para cadastro de clientes
app.get('/cadastro-cliente', (req, res) => {
  res.render('customer-register');
});

// Rota para reserva de mesas
app.get('/reservas', (req, res) => {
  res.render('booking-system');
});

// Rota para avaliação de pedido
app.get('/avaliar-pedido', (req, res) => {
  res.render('order-review');
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
  const { produto_id, quantidade, quantidade_minima } = req.body;
  const minima = quantidade_minima !== undefined ? quantidade_minima : 10; // Valor padrão de 10
  
  // Verificar se o produto existe
  const checkSql = 'SELECT id FROM produtos WHERE id = ?';
  db.get(checkSql, [produto_id], (err, row) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao verificar produto' });
      return;
    }
    
    if (!row) {
      res.status(404).json({ error: 'Produto não encontrado' });
      return;
    }
    
    // Atualizar ou inserir o estoque
    const sql = `INSERT OR REPLACE INTO estoque (produto_id, quantidade_atual, quantidade_minima, ultima_atualizacao) 
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)`;
    db.run(sql, [produto_id, quantidade, minima], function(err) {
      if (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao atualizar estoque' });
        return;
      }
      res.json({ success: true });
    });
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

// Rota para atualizar status do pedido
app.put('/api/orders/update-status', (req, res) => {
  const { id, status } = req.body;
  const sql = 'UPDATE pedidos SET status = ? WHERE id = ?';
  db.run(sql, [status, id], function(err) {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao atualizar status do pedido' });
      return;
    }
    
    if (this.changes === 0) {
      res.status(404).json({ error: 'Pedido não encontrado' });
      return;
    }
    
    res.json({ success: true, affectedRows: this.changes });
    
    // Emitir atualização via socket para notificar outros painéis
    if (io) {
      io.emit('pedido_atualizado', { id, status });
    }
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

// Rota para criar pedidos
app.post('/api/orders', (req, res) => {
  const { mesa, itens, total } = req.body;
  
  // Primeiro, encontrar o ID da mesa pelo número
  const mesaSql = 'SELECT id FROM mesas WHERE numero = ?';
  db.get(mesaSql, [mesa], (err, mesaRow) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Erro ao encontrar mesa' });
    }
    
    if (!mesaRow) {
      return res.status(404).json({ error: `Mesa ${mesa} não encontrada` });
    }
    
    // Salvar no banco de dados com status 'pendente'
    const sql = 'INSERT INTO pedidos (mesa_id, itens, status, total) VALUES (?, ?, ?, ?)';
    const itensJson = JSON.stringify(itens);
    db.run(sql, [mesaRow.id, itensJson, 'pendente', total], function(err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Erro ao salvar pedido' });
      }
      
      // Emitir para todos os clientes conectados via WebSocket
      if (io) {
        io.emit('pedido_atualizado', {
          id: this.lastID,
          mesa: mesa,
          itens: itens,
          status: 'pendente',
          hora_pedido: new Date()
        });
      }
      
      res.json({ success: true, orderId: this.lastID });
    });
  });
});

// APIs para o dashboard administrativo
app.get('/api/dashboard/stats', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  
  const queries = {
    occupiedTables: 'SELECT COUNT(*) as count FROM mesas WHERE status = "ocupada"',
    todayOrders: `SELECT COUNT(*) as count FROM pedidos WHERE DATE(hora_pedido) = "${today}" AND status = "entregue"`,
    todayRevenue: `SELECT COALESCE(SUM(total), 0) as revenue FROM pedidos WHERE DATE(hora_pedido) = "${today}" AND status = "entregue"`,
    activeCustomers: 'SELECT COUNT(*) as count FROM clientes'
  };
  
  const results = {};
  
  const executeQuery = (key, query, callback) => {
    db.get(query, [], (err, row) => {
      if (err) {
        console.error(`Erro na query ${key}:`, err);
        results[key] = 0;
      } else {
        results[key] = row ? (row.count || row.revenue || 0) : 0;
      }
      callback();
    });
  };
  
  let completed = 0;
  const totalQueries = Object.keys(queries).length;
  
  Object.entries(queries).forEach(([key, query]) => {
    executeQuery(key, query, () => {
      completed++;
      if (completed === totalQueries) {
        res.json(results);
      }
    });
  });
});

app.get('/api/orders/recent', (req, res) => {
  const sql = `SELECT p.*, m.numero as mesa 
               FROM pedidos p 
               JOIN mesas m ON p.mesa_id = m.id 
               ORDER BY p.hora_pedido DESC 
               LIMIT 10`;
  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao buscar pedidos recentes' });
      return;
    }
    res.json(rows);
  });
});

// API para adicionar mesa
app.post('/api/tables', (req, res) => {
  const { numero, capacidade } = req.body;
  const sql = 'INSERT INTO mesas (numero, capacidade, status) VALUES (?, ?, ?)';
  db.run(sql, [numero, capacidade, 'disponivel'], function(err) {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao adicionar mesa' });
      return;
    }
    res.json({ success: true, id: this.lastID });
  });
});

// API para adicionar produto
app.post('/api/products', (req, res) => {
  const { nome, descricao, preco, categoria_id, estoque, ingredientes, tipo, tempo_preparo } = req.body;
  const sql = 'INSERT INTO produtos (nome, descricao, preco, categoria_id, estoque, ingredientes, tipo, tempo_preparo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
  db.run(sql, [nome, descricao, preco, categoria_id, estoque, ingredientes, tipo || 'comida', tempo_preparo || 15], function(err) {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao adicionar produto' });
      return;
    }
    
    // Adicionar ao estoque também
    const estoqueSql = 'INSERT INTO estoque (produto_id, quantidade_atual, quantidade_minima) VALUES (?, ?, ?)';
    db.run(estoqueSql, [this.lastID, estoque, 10], (err) => {
      if (err) console.error('Erro ao adicionar estoque:', err);
    });
    
    res.json({ success: true, id: this.lastID });
  });
});

// API para excluir produto
app.delete('/api/products/:id', (req, res) => {
  const id = req.params.id;
  const sql = 'DELETE FROM produtos WHERE id = ?';
  db.run(sql, [id], function(err) {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao excluir produto' });
      return;
    }
    
    if (this.changes === 0) {
      res.status(404).json({ error: 'Produto não encontrado' });
      return;
    }
    
    res.json({ success: true });
  });
});

// API para adicionar mesa
app.post('/api/tables', (req, res) => {
  const { numero, capacidade } = req.body;
  const sql = 'INSERT INTO mesas (numero, capacidade, status) VALUES (?, ?, ?)';
  db.run(sql, [numero, capacidade, 'disponivel'], function(err) {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao adicionar mesa' });
      return;
    }
    res.json({ success: true, id: this.lastID });
  });
});

// API para excluir mesa
app.delete('/api/tables/:id', (req, res) => {
  const id = req.params.id;
  const sql = 'DELETE FROM mesas WHERE id = ?';
  db.run(sql, [id], function(err) {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao excluir mesa' });
      return;
    }
    
    if (this.changes === 0) {
      res.status(404).json({ error: 'Mesa não encontrada' });
      return;
    }
    
    res.json({ success: true });
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

// Rota para obter detalhes de uma mesa específica
app.get('/api/tables/:id', (req, res) => {
  const id = req.params.id;
  const sql = 'SELECT * FROM mesas WHERE id = ?';
  db.get(sql, [id], (err, row) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao buscar mesa' });
      return;
    }
    if (!row) {
      res.status(404).json({ error: 'Mesa não encontrada' });
      return;
    }
    res.json(row);
  });
});

// Rota para atualizar status da mesa
app.put('/api/tables/:id', (req, res) => {
  const id = req.params.id;
  const { status, nome_cliente } = req.body;
  
  // Montar dinamicamente a query SQL com base nos campos fornecidos
  let sql = 'UPDATE mesas SET ';
  const params = [];
  
  if (status !== undefined) {
    sql += 'status = ?';
    params.push(status);
  }
  
  if (nome_cliente !== undefined) {
    if (params.length > 0) {
      sql += ', ';
    }
    sql += 'nome_cliente = ?';
    params.push(nome_cliente);
  }
  
  sql += ' WHERE id = ?';
  params.push(id);
  
  db.run(sql, params, function(err) {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao atualizar mesa' });
      return;
    }
    
    if (this.changes === 0) {
      res.status(404).json({ error: 'Mesa não encontrada' });
      return;
    }
    
    res.json({ success: true });
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