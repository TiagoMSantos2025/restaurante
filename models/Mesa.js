const mongoose = require('mongoose');

const mesaSchema = new mongoose.Schema({
  restaurante: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurante',
    required: true
  },
  numero: {
    type: Number,
    required: true
  },
  capacidade: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['disponivel', 'ocupada', 'reservada'],
    default: 'disponivel'
  },
  qrCode: {
    type: String,
    required: true
  },
  currentOrder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Pedido',
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Mesa', mesaSchema);