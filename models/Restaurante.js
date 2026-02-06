const mongoose = require('mongoose');

const produtoSchema = new mongoose.Schema({
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
  categoria: {
    type: String,
    required: true,
    enum: ['comida', 'bebida'] // comida vai para cozinha, bebida vai para balcão
  },
  ingredientes: [{
    type: String
  }],
  imagem: {
    type: String, // Caminho para a imagem opcional
    default: null
  },
  ativo: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

const restauranteSchema = new mongoose.Schema({
  nome: {
    type: String,
    required: true,
    unique: true
  },
  endereco: {
    type: String,
    required: true
  },
  telefone: {
    type: String,
    required: true
  },
  proprietario: {
    type: String,
    required: true
  },
  ativo: {
    type: Boolean,
    default: true
  },
  produtos: [produtoSchema],
  mesas: [{
    numero: Number,
    capacidade: Number,
    qrCode: String
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('Restaurante', restauranteSchema);