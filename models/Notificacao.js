const mongoose = require('mongoose');

const notificacaoSchema = new mongoose.Schema({
  titulo: {
    type: String,
    required: true
  },
  mensagem: {
    type: String,
    required: true
  },
  tipo: {
    type: String,
    enum: ['info', 'success', 'warning', 'error'],
    default: 'info'
  },
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario'
  },
  lida: {
    type: Boolean,
    default: false
  },
  dadosExtra: {
    type: Object,
    default: {}
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Notificacao', notificacaoSchema);