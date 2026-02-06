const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const http = require('http');
const socketIo = require('socket.io');
const QRCode = require('qrcode');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const path = require('path');
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

// Conexão com o banco de dados
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/restaurante_extradeiro');
    console.log('MongoDB conectado...');
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
};

connectDB();

// Importação de modelos
const Mesa = require('./models/Mesa');
const ItemCardapio = require('./models/ItemCardapio');
const Pedido = require('./models/Pedido');
const Usuario = require('./models/Usuario');
const HistoricoPedido = require('./models/HistoricoPedido');

// Middleware de autenticação
const { auth, authorize } = require('./middleware/auth');

// Rotas
app.get('/', (req, res) => {
  res.send('API do Restaurante Estradeiro');
});

// Rota de autenticação
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, senha } = req.body;

    // Validação básica
    if (!email || !senha) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
    }

    // Procura usuário pelo email
    const usuario = await Usuario.findOne({ email, ativo: true });
    if (!usuario) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    // Verifica a senha
    const isValidPassword = await usuario.compararSenha(senha);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    // Gera token JWT
    const token = jwt.sign(
      { usuarioId: usuario._id, tipo: usuario.tipo },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      usuario: {
        id: usuario._id,
        nome: usuario.nome,
        email: usuario.email,
        tipo: usuario.tipo
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro no servidor.' });
  }
});

// Rota para registro de usuários (apenas para testes, deve ser controlada)
app.post('/api/auth/register', async (req, res) => {
  try {
    const { nome, email, senha, tipo } = req.body;

    // Validação
    if (!nome || !email || !senha) {
      return res.status(400).json({ error: 'Nome, email e senha são obrigatórios.' });
    }

    // Verifica se o usuário já existe
    const usuarioExistente = await Usuario.findOne({ email });
    if (usuarioExistente) {
      return res.status(400).json({ error: 'Usuário com este email já existe.' });
    }

    // Cria novo usuário
    const novoUsuario = new Usuario({
      nome,
      email,
      senha,
      tipo: tipo || 'cliente'
    });

    await novoUsuario.save();

    // Gera token JWT
    const token = jwt.sign(
      { usuarioId: novoUsuario._id, tipo: novoUsuario.tipo },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      token,
      usuario: {
        id: novoUsuario._id,
        nome: novoUsuario.nome,
        email: novoUsuario.email,
        tipo: novoUsuario.tipo
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro no servidor.' });
  }
});

// Rotas protegidas para administradores
app.get('/api/admin/usuarios', auth, authorize('admin', 'gerente'), async (req, res) => {
  try {
    const usuarios = await Usuario.find({}, '-senha');
    res.json(usuarios);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro no servidor.' });
  }
});

// Rotas para mesas (protegidas para administradores/gerentes)
app.get('/api/mesas', auth, authorize('admin', 'gerente', 'balcao'), async (req, res) => {
  try {
    const mesas = await Mesa.find().populate('pedidoAtual');
    res.json(mesas);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/mesas', auth, authorize('admin', 'gerente'), async (req, res) => {
  try {
    // Gerar código QR único para a mesa
    const codigoQR = `qr-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const novaMesa = new Mesa({
      ...req.body,
      codigoQR
    });
    await novaMesa.save();
    res.json(novaMesa);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rota para obter mesa por código QR (acessível para clientes via cardápio digital)
app.get('/api/mesa/:codigoQR', async (req, res) => {
  try {
    const { codigoQR } = req.params;
    const mesa = await Mesa.findOne({ codigoQR }).populate('pedidoAtual');
    
    if (!mesa) {
      return res.status(404).json({ error: 'Mesa não encontrada' });
    }
    
    res.json(mesa);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rota para gerar QR code para uma mesa específica
app.get('/api/qrcode/:codigoQR', async (req, res) => {
  try {
    const { codigoQR } = req.params;
    const url = `${process.env.BASE_URL || 'http://localhost:3000'}/cardapio/${codigoQR}`;
    
    const qrCodeUrl = await QRCode.toDataURL(url);
    res.json({ qrCodeUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rota para o cardápio digital (acessível publicamente)
app.get('/cardapio/:codigoQR', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Servir arquivos estáticos para o cardápio digital
app.use('/public', express.static(__dirname + '/public'));

// Rotas para cardápio (acessíveis para administradores e gerentes)
app.get('/api/cardapio', async (req, res) => {
  try {
    const itens = await ItemCardapio.find();
    res.json(itens);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/cardapio', auth, authorize('admin', 'gerente'), async (req, res) => {
  try {
    const novoItem = new ItemCardapio(req.body);
    await novoItem.save();
    res.json(novoItem);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rotas para pedidos (com diferentes níveis de acesso)
app.get('/api/pedidos', auth, authorize('admin', 'gerente', 'balcao', 'cozinha'), async (req, res) => {
  try {
    const pedidos = await Pedido.find()
      .populate('mesa')
      .populate('itens.item');
    res.json(pedidos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/pedidos', async (req, res) => {
  try {
    // Calcular valor total do pedido
    let valorTotal = 0;
    for (const itemPedido of req.body.itens) {
      const item = await ItemCardapio.findById(itemPedido.item);
      if (item) {
        valorTotal += item.preco * itemPedido.quantidade;
      }
    }

    const novoPedido = new Pedido({
      ...req.body,
      valorTotal
    });
    await novoPedido.save();
    
    // Atualiza o status da mesa para ocupada
    await Mesa.findByIdAndUpdate(
      req.body.mesa,
      { status: 'ocupada', cliente: req.body.cliente, pedidoAtual: novoPedido._id },
      { new: true }
    );
    
    // Emite evento de novo pedido para os clientes conectados
    io.emit('novo_pedido', novoPedido);
    
    res.json(novoPedido);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/pedidos/:id/status', auth, authorize('admin', 'gerente', 'balcao', 'cozinha'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const pedido = await Pedido.findByIdAndUpdate(
      id,
      { 
        status,
        ...(status === 'confirmado' ? { dataConfirmacao: new Date() } : {}),
        ...(status === 'entregue' ? { dataEntrega: new Date() } : {})
      },
      { new: true }
    ).populate('mesa').populate('itens.item');
    
    if (pedido) {
      io.emit('pedido_atualizado', pedido);
      res.json(pedido);
    } else {
      res.status(404).json({ error: 'Pedido não encontrado' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rota para obter histórico de pedidos de um usuário
app.get('/api/historico/:usuarioId', auth, authorize('admin', 'gerente', 'cliente'), async (req, res) => {
  try {
    const { usuarioId } = req.params;
    
    // Verificar se o usuário está acessando seu próprio histórico ou se é admin/gerente
    if (req.usuario.tipo !== 'admin' && req.usuario.tipo !== 'gerente' && req.usuario._id.toString() !== usuarioId) {
      return res.status(403).json({ error: 'Acesso negado.' });
    }
    
    const historicoPedidos = await HistoricoPedido.find({ usuarioId, ativo: true })
      .populate('mesa')
      .populate('itens.item')
      .sort({ dataPedido: -1 });
    
    res.json(historicoPedidos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rota para obter todos os históricos (somente para admins e gerentes)
app.get('/api/historico', auth, authorize('admin', 'gerente'), async (req, res) => {
  try {
    const historicoPedidos = await HistoricoPedido.find({ ativo: true })
      .populate('usuarioId')
      .populate('mesa')
      .populate('itens.item')
      .sort({ dataPedido: -1 });
    
    res.json(historicoPedidos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rota para adicionar item aos favoritos
app.post('/api/favoritos/:itemId', auth, authorize('cliente'), async (req, res) => {
  try {
    const { itemId } = req.params;
    const usuarioId = req.usuario._id;
    
    const usuario = await Usuario.findById(usuarioId);
    if (!usuario.favoritos.includes(itemId)) {
      usuario.favoritos.push(itemId);
      await usuario.save();
    }
    
    res.json({ message: 'Item adicionado aos favoritos' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rota para remover item dos favoritos
app.delete('/api/favoritos/:itemId', auth, authorize('cliente'), async (req, res) => {
  try {
    const { itemId } = req.params;
    const usuarioId = req.usuario._id;
    
    const usuario = await Usuario.findById(usuarioId);
    usuario.favoritos = usuario.favoritos.filter(id => id.toString() !== itemId);
    await usuario.save();
    
    res.json({ message: 'Item removido dos favoritos' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rota para obter favoritos do usuário
app.get('/api/favoritos', auth, authorize('cliente'), async (req, res) => {
  try {
    const usuarioId = req.usuario._id;
    
    const usuario = await Usuario.findById(usuarioId).populate('favoritos');
    
    res.json(usuario.favoritos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rota para adicionar avaliação a um item do cardápio
app.post('/api/cardapio/:itemId/avaliacao', auth, authorize('cliente'), async (req, res) => {
  try {
    const { itemId } = req.params;
    const { nota, comentario } = req.body;
    
    // Validar nota
    if (nota < 1 || nota > 5) {
      return res.status(400).json({ error: 'A nota deve estar entre 1 e 5' });
    }
    
    const item = await ItemCardapio.findById(itemId);
    if (!item) {
      return res.status(404).json({ error: 'Item não encontrado' });
    }
    
    // Verificar se o usuário já avaliou este item
    const avaliacaoExistente = item.avaliacoes.find(av => 
      av.usuarioId && av.usuarioId.toString() === req.usuario._id.toString()
    );
    
    if (avaliacaoExistente) {
      return res.status(400).json({ error: 'Você já avaliou este item' });
    }
    
    // Adicionar nova avaliação
    item.avaliacoes.push({
      usuarioId: req.usuario._id,
      nota,
      comentario
    });
    
    // Recalcular média de avaliações
    const soma = item.avaliacoes.reduce((acc, curr) => acc + curr.nota, 0);
    item.mediaAvaliacoes = soma / item.avaliacoes.length;
    
    await item.save();
    
    res.json({ message: 'Avaliação adicionada com sucesso', mediaAvaliacoes: item.mediaAvaliacoes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rota para obter avaliações de um item
app.get('/api/cardapio/:itemId/avaliacoes', async (req, res) => {
  try {
    const { itemId } = req.params;
    
    const item = await ItemCardapio.findById(itemId).populate('avaliacoes.usuarioId', 'nome');
    if (!item) {
      return res.status(404).json({ error: 'Item não encontrado' });
    }
    
    res.json(item.avaliacoes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Importar modelo de estatísticas
const Estatisticas = require('./models/Estatisticas');

// Rota para obter relatório de vendas
app.get('/api/relatorios/vendas', auth, authorize('admin', 'gerente'), async (req, res) => {
  try {
    const { periodo, dataInicio, dataFim } = req.query;
    
    // Se não for solicitado um período específico, pegar últimos 30 dias
    let filtro = {};
    if (dataInicio && dataFim) {
      filtro = {
        dataPedido: {
          $gte: new Date(dataInicio),
          $lte: new Date(dataFim)
        }
      };
    } else {
      // Pegar últimos 30 dias por padrão
      const trintaDiasAtras = new Date();
      trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);
      filtro = {
        dataPedido: {
          $gte: trintaDiasAtras
        }
      };
    }
    
    const pedidos = await Pedido.find(filtro).populate('itens.item');
    
    // Calcular métricas
    const vendasTotais = pedidos.reduce((total, pedido) => total + pedido.valorTotal, 0);
    const pedidosTotais = pedidos.length;
    const ticketMedio = pedidosTotais > 0 ? vendasTotais / pedidosTotais : 0;
    
    // Itens mais vendidos
    const itensQuantidade = {};
    pedidos.forEach(pedido => {
      pedido.itens.forEach(itemPedido => {
        const itemId = itemPedido.item._id.toString();
        if (itensQuantidade[itemId]) {
          itensQuantidade[itemId].quantidade += itemPedido.quantidade;
        } else {
          itensQuantidade[itemId] = {
            itemId: itemPedido.item._id,
            nomeItem: itemPedido.item.nome,
            quantidade: itemPedido.quantidade
          };
        }
      });
    });
    
    const itensMaisVendidos = Object.values(itensQuantidade)
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 10); // Top 10
    
    // Receita por categoria
    const receitaPorCategoria = {};
    pedidos.forEach(pedido => {
      pedido.itens.forEach(itemPedido => {
        const categoria = itemPedido.item.categoria;
        const valorItem = itemPedido.item.preco * itemPedido.quantidade;
        if (receitaPorCategoria[categoria]) {
          receitaPorCategoria[categoria] += valorItem;
        } else {
          receitaPorCategoria[categoria] = valorItem;
        }
      });
    });
    
    const relatorio = {
      vendasTotais,
      pedidosTotais,
      ticketMedio,
      itensMaisVendidos,
      receitaPorCategoria: Object.entries(receitaPorCategoria).map(([categoria, receita]) => ({
        categoria,
        receita
      })),
      periodo: filtro.dataPedido
    };
    
    res.json(relatorio);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rota para obter estatísticas gerais
app.get('/api/estatisticas', auth, authorize('admin', 'gerente'), async (req, res) => {
  try {
    const { periodo = 'mensal', limite = 12 } = req.query;
    
    const estatisticas = await Estatisticas.find({})
      .sort({ dataReferencia: -1 })
      .limit(parseInt(limite));
    
    res.json(estatisticas);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Importar serviço de notificações
const NotificacaoService = require('./services/notificacaoService');

// Rota para salvar subscrição push
app.post('/api/notifications/subscribe', auth, async (req, res) => {
  try {
    const { subscription, tipo } = req.body;
    const usuarioId = req.usuario._id;
    
    if (!subscription || !tipo) {
      return res.status(400).json({ error: 'Subscrição e tipo são obrigatórios' });
    }
    
    const novaSubscricao = await NotificacaoService.salvarSubscricao(usuarioId, subscription, tipo);
    
    res.status(201).json({ message: 'Subscrição realizada com sucesso', id: novaSubscricao._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rota para remover subscrição push
app.delete('/api/notifications/unsubscribe/:subscriptionId', auth, async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const usuarioId = req.usuario._id;
    
    // Verificar se a subscrição pertence ao usuário
    const subscricao = await SubscricaoPush.findOne({ _id: subscriptionId, usuarioId });
    if (!subscricao) {
      return res.status(404).json({ error: 'Subscrição não encontrada ou não pertence ao usuário' });
    }
    
    await NotificacaoService.removerSubscricao(subscriptionId);
    
    res.json({ message: 'Subscrição removida com sucesso' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Configuração do Socket.IO para notificações em tempo real
io.on('connection', (socket) => {
  console.log('Novo cliente conectado:', socket.id);

  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
  });

  // Balcão se conecta e ouve novos pedidos
  socket.on('balcao_connect', () => {
    socket.join('balcao');
  });

  // Cozinha se conecta e ouve pedidos confirmados
  socket.on('cozinha_connect', () => {
    socket.join('cozinha');
  });

  // Cliente se conecta e ouve atualizações do seu pedido
  socket.on('cliente_connect', (mesaNumero) => {
    socket.join(`mesa_${mesaNumero}`);
  });
});

// Eventos para envio de notificações push
io.on('novo_pedido', async (pedido) => {
  try {
    // Emitir para sockets
    io.emit('novo_pedido', pedido);
    
    // Enviar notificação push para equipe do balcão
    const payload = {
      title: 'Novo Pedido Recebido',
      body: `Pedido #${pedido._id} na mesa ${pedido.mesa.numero}`,
      data: { pedidoId: pedido._id, mesa: pedido.mesa.numero }
    };
    
    await NotificacaoService.enviarNotificacaoGlobal(payload, 'balcao');
  } catch (error) {
    console.error('Erro ao enviar notificação push:', error);
  }
});

io.on('pedido_atualizado', async (pedido) => {
  try {
    // Emitir para sockets
    io.emit('pedido_atualizado', pedido);
    
    // Enviar notificação push com base no status
    let payload, tipo;
    
    switch(pedido.status) {
      case 'confirmado':
        payload = {
          title: 'Pedido Confirmado',
          body: `Pedido #${pedido._id} foi confirmado`,
          data: { pedidoId: pedido._id, mesa: pedido.mesa.numero }
        };
        tipo = 'cozinha';
        break;
        
      case 'preparando':
        payload = {
          title: 'Pedido em Preparo',
          body: `Pedido #${pedido._id} está sendo preparado`,
          data: { pedidoId: pedido._id, mesa: pedido.mesa.numero }
        };
        tipo = 'cliente';
        break;
        
      case 'pronto':
        payload = {
          title: 'Pedido Pronto',
          body: `Pedido #${pedido._id} está pronto para entrega`,
          data: { pedidoId: pedido._id, mesa: pedido.mesa.numero }
        };
        tipo = 'balcao';
        break;
        
      case 'entregue':
        payload = {
          title: 'Pedido Entregue',
          body: `Pedido #${pedido._id} foi entregue`,
          data: { pedidoId: pedido._id, mesa: pedido.mesa.numero }
        };
        tipo = 'cliente';
        break;
        
      default:
        return; // Não enviar notificação para outros status
    }
    
    if (payload && tipo) {
      await NotificacaoService.enviarNotificacaoGlobal(payload, tipo);
    }
  } catch (error) {
    console.error('Erro ao enviar notificação push:', error);
  }
});

// Importar serviço de backup
const BackupService = require('./services/backupService');

// Iniciar backups automáticos (a cada 24 horas)
const BACKUP_DIR = path.join(__dirname, 'backups');
const DB_NAME = process.env.MONGODB_URI ? process.env.MONGODB_URI.split('/').pop() : 'restaurante_extradeiro';

// Garantir que o diretório de backups exista
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Programar backups automáticos (a cada 24 horas)
BackupService.programarBackups(24, BACKUP_DIR, DB_NAME);

// Limpar backups antigos (mantendo os últimos 30 dias)
setInterval(() => {
  BackupService.limparBackupsAntigos(BACKUP_DIR, 30).catch(console.error);
}, 24 * 60 * 60 * 1000); // Executar a cada 24 horas

// Importar serviço de internacionalização
const I18nService = require('./services/i18nService');

// Inicializar o serviço de internacionalização
I18nService.initialize().catch(console.error);

// Middleware para detectar idioma do usuário
app.use((req, res, next) => {
  // Detectar idioma a partir do cabeçalho Accept-Language ou parâmetro de query
  let lng = req.query.lng || req.headers['accept-language']?.split(',')[0]?.substring(0, 2) || 'pt';
  
  // Verificar se o idioma é suportado
  if (!I18nService.isLanguageSupported(lng)) {
    lng = 'pt'; // Idioma padrão
  }
  
  req.language = lng;
  next();
});

// Rota para obter traduções
app.get('/api/translations/:lng?', (req, res) => {
  const lng = req.params.lng || req.language || 'pt';
  
  if (!I18nService.isLanguageSupported(lng)) {
    return res.status(400).json({ error: 'Idioma não suportado' });
  }
  
  // Retornar todas as traduções para o idioma solicitado
  res.json({
    language: lng,
    translations: require(`./i18n/${lng}/translation.json`)
  });
});

// Importar serviço de fidelidade
const FidelidadeService = require('./services/fidelidadeService');

// Rota para obter perfil de fidelidade do usuário
app.get('/api/fidelidade/perfil', auth, async (req, res) => {
  try {
    const usuarioId = req.usuario._id;
    const perfil = await FidelidadeService.getPerfil(usuarioId);
    
    res.json(perfil);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rota para obter recompensas disponíveis
app.get('/api/fidelidade/recompensas', async (req, res) => {
  try {
    const recompensas = await FidelidadeService.getRecompensasDisponiveis();
    
    res.json(recompensas);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rota para resgatar uma recompensa
app.post('/api/fidelidade/resgatar', auth, async (req, res) => {
  try {
    const { recompensaId } = req.body;
    const usuarioId = req.usuario._id;
    
    if (!recompensaId) {
      return res.status(400).json({ error: 'ID da recompensa é obrigatório' });
    }
    
    const perfil = await FidelidadeService.resgatarRecompensa(usuarioId, recompensaId);
    
    res.json({ 
      message: 'Recompensa resgatada com sucesso', 
      perfil,
      pontosRestantes: perfil.pontosAcumulados
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rota para adicionar recompensa (somente para administradores)
app.post('/api/fidelidade/recompensas', auth, authorize('admin', 'gerente'), async (req, res) => {
  try {
    const { nome, descricao, pontosNecessarios, limiteDiario } = req.body;
    
    const novaRecompensa = new Recompensa({
      nome,
      descricao,
      pontosNecessarios,
      limiteDiario
    });
    
    await novaRecompensa.save();
    
    res.status(201).json(novaRecompensa);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});