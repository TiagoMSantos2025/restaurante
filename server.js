const express = require('express');
const mongoose = require('mongoose');
const socketIo = require('socket.io');
const http = require('http');
const QRCode = require('qrcode');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const moment = require('moment');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use(multer().none());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sistema_restaurante', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Models
const Mesa = require('./models/Mesa');
const Pedido = require('./models/Pedido');
const Usuario = require('./models/Usuario');
const Notificacao = require('./models/Notificacao');
const Fidelidade = require('./models/Fidelidade');
const Restaurante = require('./models/Restaurante');

// Services
const fidelidadeService = require('./services/fidelidadeService');
const i18nService = require('./services/i18nService');

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'sistema_restaurante_generico_secret';

// Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
};

// Role-based Authorization Middleware
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

// QR Code Generation
const generateQRCode = async (tableNumber, restauranteId) => {
  try {
    const qrData = JSON.stringify({
      tableNumber: tableNumber,
      restauranteId: restauranteId,
      timestamp: Date.now()
    });
    return await QRCode.toDataURL(qrData);
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw error;
  }
};

// Socket.IO Connection
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', (room) => {
    socket.join(room);
    console.log(`Socket ${socket.id} joined room ${room}`);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Routes

// Authentication Routes
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password, role } = req.body;

    const user = await Usuario.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if role matches
    if (role && user.role !== role) {
      return res.status(403).json({ error: 'Role mismatch' });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Check if user already exists
    const existingUser = await Usuario.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new Usuario({
      name,
      email,
      password: hashedPassword,
      role: role || 'client'
    });

    await newUser.save();

    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin Routes
app.get('/api/admin/restaurantes', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const restaurantes = await Restaurante.find().select('-produtos'); // Não retorna os produtos para economizar dados
    res.json(restaurantes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/restaurantes', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { nome, endereco, telefone, proprietario } = req.body;
    
    const novoRestaurante = new Restaurante({
      nome,
      endereco,
      telefone,
      proprietario
    });
    
    await novoRestaurante.save();
    res.status(201).json(novoRestaurante);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/restaurantes/:id', authenticateToken, async (req, res) => {
  try {
    const restaurante = await Restaurante.findById(req.params.id);
    if (!restaurante) {
      return res.status(404).json({ error: 'Restaurante não encontrado' });
    }
    res.json(restaurante);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Product Routes
app.get('/api/restaurantes/:restauranteId/produtos', authenticateToken, async (req, res) => {
  try {
    const restaurante = await Restaurante.findById(req.params.restauranteId);
    if (!restaurante) {
      return res.status(404).json({ error: 'Restaurante não encontrado' });
    }
    res.json(restaurante.produtos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/restaurantes/:restauranteId/produtos', authenticateToken, authorizeRoles('admin', 'manager'), async (req, res) => {
  try {
    const { nome, descricao, preco, categoria, ingredientes, imagem } = req.body;
    
    const produto = {
      nome,
      descricao,
      preco,
      categoria,
      ingredientes: ingredientes || [],
      imagem: imagem || null
    };
    
    const restaurante = await Restaurante.findByIdAndUpdate(
      req.params.restauranteId,
      { $push: { produtos: produto } },
      { new: true, runValidators: true }
    );
    
    if (!restaurante) {
      return res.status(404).json({ error: 'Restaurante não encontrado' });
    }
    
    res.status(201).json(produto);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Table Routes
app.get('/api/restaurantes/:restauranteId/mesas', authenticateToken, async (req, res) => {
  try {
    const restaurante = await Restaurante.findById(req.params.restauranteId);
    if (!restaurante) {
      return res.status(404).json({ error: 'Restaurante não encontrado' });
    }
    res.json(restaurante.mesas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/restaurantes/:restauranteId/mesas', authenticateToken, authorizeRoles('admin', 'manager'), async (req, res) => {
  try {
    const { numero, capacidade } = req.body;
    
    // Generate QR code for the table
    const qrCode = await generateQRCode(numero, req.params.restauranteId);
    
    const mesa = {
      numero,
      capacidade,
      qrCode
    };
    
    const restaurante = await Restaurante.findByIdAndUpdate(
      req.params.restauranteId,
      { $push: { mesas: mesa } },
      { new: true, runValidators: true }
    );
    
    if (!restaurante) {
      return res.status(404).json({ error: 'Restaurante não encontrado' });
    }
    
    res.status(201).json(mesa);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Menu Item Routes
app.get('/api/cardapio/:restauranteId', authenticateToken, async (req, res) => {
  try {
    const restaurante = await Restaurante.findById(req.params.restauranteId);
    if (!restaurante) {
      return res.status(404).json({ error: 'Restaurante não encontrado' });
    }
    res.json(restaurante.produtos.filter(p => p.ativo));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Order Routes
app.get('/api/pedidos', authenticateToken, async (req, res) => {
  try {
    // Only return orders for the user's assigned restaurant (if applicable)
    // For now, returning all orders with populate
    const pedidos = await Pedido.find()
      .populate('mesa')
      .populate('restaurante')
      .sort({ createdAt: -1 });
    res.json(pedidos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/pedidos/:restauranteId', authenticateToken, async (req, res) => {
  try {
    const pedidos = await Pedido.find({ restaurante: req.params.restauranteId })
      .populate('mesa')
      .sort({ createdAt: -1 });
    res.json(pedidos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/pedidos/:restauranteId/:tableNumber', async (req, res) => {
  try {
    const restaurante = await Restaurante.findOne({ _id: req.params.restauranteId });
    if (!restaurante) {
      return res.status(404).json({ error: 'Restaurante não encontrado' });
    }

    const mesa = restaurante.mesas.find(m => m.numero == req.params.tableNumber);
    if (!mesa) {
      return res.status(404).json({ error: 'Mesa não encontrada' });
    }

    const pedidos = await Pedido.find({ mesa: mesa._id })
      .populate('mesa')
      .sort({ createdAt: -1 });
    res.json(pedidos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/pedidos', async (req, res) => {
  try {
    const { mesaNumero, restauranteId, itens, clienteNome } = req.body;

    const restaurante = await Restaurante.findById(restauranteId);
    if (!restaurante) {
      return res.status(404).json({ error: 'Restaurante não encontrado' });
    }

    // Find the table in the restaurant
    const mesaInfo = restaurante.mesas.find(m => m.numero == mesaNumero);
    if (!mesaInfo) {
      return res.status(404).json({ error: 'Mesa não encontrada' });
    }

    // Create a new Mesa document linked to this restaurant
    const mesa = new Mesa({
      restaurante: restaurante._id,
      numero: mesaInfo.numero,
      capacidade: mesaInfo.capacidade,
      qrCode: mesaInfo.qrCode
    });
    await mesa.save();

    // Calculate total
    const total = itens.reduce((sum, item) => sum + (item.preco * item.quantidade), 0);

    const novoPedido = new Pedido({
      restaurante: restaurante._id,
      mesa: mesa._id,
      itens,
      clienteNome,
      total,
      status: 'received' // received -> confirmed -> preparing -> ready -> delivered
    });

    await novoPedido.save();

    // Emit notification to kitchen and counter for this specific restaurant
    io.to(`restaurante_${restaurante._id}`).emit('novo-pedido', novoPedido);
    io.to(`restaurante_${restaurante._id}`).emit('pedido-atualizado', novoPedido);

    // Emit sound notification for new order
    io.to(`restaurante_${restaurante._id}`).emit('novo-pedido-sound', true);

    // Register loyalty points for the customer
    if (clienteNome) {
      try {
        await fidelidadeService.registrarGanhoPontos(
          'demo_user_id', // In a real app, this would be the actual user ID
          total,
          `Pedido #${novoPedido._id.toString().slice(-6)}`
        );
      } catch (loyaltyError) {
        console.error('Error awarding loyalty points:', loyaltyError);
        // Continue processing even if loyalty points fail
      }
    }

    res.status(201).json(novoPedido);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/pedidos/:id/status', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;
    const pedido = await Pedido.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate('mesa').populate('restaurante');

    if (!pedido) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Emit notification about status update to the specific restaurant room
    io.to(`restaurante_${pedido.restaurante._id}`).emit('pedido-atualizado', pedido);

    res.json(pedido);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Notification Routes
app.get('/api/notificacoes', authenticateToken, async (req, res) => {
  try {
    const notificacoes = await Notificacao.find()
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(notificacoes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/notificacoes', authenticateToken, async (req, res) => {
  try {
    const { titulo, mensagem, tipo } = req.body;
    
    const novaNotificacao = new Notificacao({
      titulo,
      mensagem,
      tipo,
      usuario: req.user.id
    });

    await novaNotificacao.save();
    
    // Emit notification to all connected clients
    io.emit('nova-notificacao', novaNotificacao);

    res.status(201).json(novaNotificacao);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Analytics Routes
app.get('/api/analytics/vendas/:restauranteId', authenticateToken, authorizeRoles('admin', 'manager'), async (req, res) => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();

    const vendas = await Pedido.aggregate([
      {
        $match: {
          restaurante: mongoose.Types.ObjectId(req.params.restauranteId),
          createdAt: { $gte: startDate, $lte: endDate },
          status: 'delivered'
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
          },
          totalVendas: { $sum: { $sum: "$itens.preco" } },
          totalPedidos: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    const totalVendasPeriodo = await Pedido.aggregate([
      {
        $match: {
          restaurante: mongoose.Types.ObjectId(req.params.restauranteId),
          createdAt: { $gte: startDate, $lte: endDate },
          status: 'delivered'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: { $sum: "$itens.preco" } },
          totalPedidos: { $sum: 1 }
        }
      }
    ]);

    res.json({
      vendasPorDia: vendas,
      totalPeriodo: totalVendasPeriodo[0] || { total: 0, totalPedidos: 0 }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/analytics/produtos-mais-vendidos/:restauranteId', authenticateToken, authorizeRoles('admin', 'manager'), async (req, res) => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();

    const produtosMaisVendidos = await Pedido.aggregate([
      {
        $match: {
          restaurante: mongoose.Types.ObjectId(req.params.restauranteId),
          createdAt: { $gte: startDate, $lte: endDate },
          status: 'delivered'
        }
      },
      {
        $unwind: "$itens"
      },
      {
        $group: {
          _id: "$itens.nome",
          quantidadeVendida: { $sum: "$itens.quantidade" },
          receitaGerada: { $sum: { $multiply: ["$itens.preco", "$itens.quantidade"] } }
        }
      },
      {
        $sort: { quantidadeVendida: -1 }
      },
      {
        $limit: 10
      }
    ]);

    res.json(produtosMaisVendidos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Backup Routes
app.get('/api/backup', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const backupDir = path.join(__dirname, 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = moment().format('YYYYMMDD_HHmmss');
    const zipPath = path.join(backupDir, `backup_${timestamp}.zip`);
    
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', {
      zlib: { level: 9 }
    });

    output.on('close', () => {
      res.download(zipPath, `sistema_restaurante_backup_${timestamp}.zip`, (err) => {
        if (err) {
          console.error('Error sending backup file:', err);
        }
        // Clean up the backup file after download
        setTimeout(() => {
          fs.unlinkSync(zipPath);
        }, 60000); // Delete after 1 minute
      });
    });

    archive.on('error', (err) => {
      console.error('Archive error:', err);
      res.status(500).json({ error: 'Failed to create backup' });
    });

    archive.pipe(output);
    
    // Add database dump (simplified - in real app would export actual data)
    const dbBackup = {
      timestamp: new Date(),
      collections: ['mesas', 'pedidos', 'usuarios', 'notificacoes', 'restaurantes']
    };
    
    archive.append(JSON.stringify(dbBackup, null, 2), { name: 'db_backup.json' });
    
    // Add configuration files
    if (fs.existsSync('.env')) {
      archive.file('.env', { name: 'env_backup.txt' });
    }
    
    // Add source code
    archive.directory(path.join(__dirname, 'models'), 'models');
    archive.directory(path.join(__dirname, 'public'), 'public');
    archive.file('server.js', { name: 'server.js' });
    archive.file('package.json', { name: 'package.json' });
    
    await archive.finalize();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Loyalty Program Routes
app.get('/api/fidelidade/:userId', authenticateToken, async (req, res) => {
  try {
    const userId = req.params.userId;
    
    // Use the fidelidade service to get the profile
    const perfil = await fidelidadeService.obterPerfil(userId);
    
    res.json(perfil);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/fidelidade/resgatar', authenticateToken, async (req, res) => {
  try {
    const { recompensaId, userId } = req.body;
    
    // Process the reward redemption using the service
    const resultado = await fidelidadeService.resgatarRecompensa(userId, recompensaId);
    
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// QR Code Generation Route
app.get('/api/qrcode/:restauranteId/:tableNumber', async (req, res) => {
  try {
    const { restauranteId, tableNumber } = req.params;
    const qrCode = await generateQRCode(tableNumber, restauranteId);
    
    res.json({ qrCode });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Translation Routes
app.get('/api/translations/:locale', (req, res) => {
  try {
    const { locale } = req.params;
    const supportedLocales = i18nService.getSupportedLocales();
    
    if (!supportedLocales.includes(locale)) {
      return res.status(404).json({ error: 'Locale not supported' });
    }
    
    const translations = i18nService.translations[locale];
    res.json(translations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/translations', (req, res) => {
  try {
    const supportedLocales = i18nService.getSupportedLocales();
    const allTranslations = {};
    
    supportedLocales.forEach(locale => {
      allTranslations[locale] = i18nService.translations[locale];
    });
    
    res.json(allTranslations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve static files
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/counter', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'counter.html'));
});

app.get('/kitchen', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'kitchen.html'));
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});