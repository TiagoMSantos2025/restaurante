const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  id: {
    type: Number,
    required: true
  },
  nome: {
    type: String,
    required: true
  },
  descricao: {
    type: String,
    required: true
  },
  preco: {
    type: Number,
    required: true
  },
  quantidade: {
    type: Number,
    required: true,
    default: 1
  },
  observacoes: {
    type: String,
    default: ''
  }
});

const pedidoSchema = new mongoose.Schema({
  restaurante: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurante',
    required: true
  },
  mesa: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Mesa',
    required: true
  },
  clienteNome: {
    type: String,
    required: true
  },
  itens: [itemSchema],
  status: {
    type: String,
    enum: ['received', 'confirmed', 'preparing', 'ready', 'delivered'],
    default: 'received'
  },
  total: {
    type: Number,
    required: true
  },
  pagamentoConfirmado: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Pedido', pedidoSchema);