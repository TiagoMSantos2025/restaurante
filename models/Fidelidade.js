const mongoose = require('mongoose');

const transacaoSchema = new mongoose.Schema({
  tipo: {
    type: String,
    enum: ['ganho', 'perda'],
    required: true
  },
  pontos: {
    type: Number,
    required: true
  },
  descricao: {
    type: String,
    default: ''
  },
  valorReferencia: {
    type: Number,
    default: 0
  },
  data: {
    type: Date,
    default: Date.now
  }
});

const resgateSchema = new mongoose.Schema({
  recompensaId: {
    type: Number,
    required: true
  },
  nomeRecompensa: {
    type: String,
    required: true
  },
  pontosUtilizados: {
    type: Number,
    required: true
  },
  data: {
    type: Date,
    default: Date.now
  }
});

const fidelidadeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true,
    unique: true
  },
  pontosAcumulados: {
    type: Number,
    default: 0
  },
  nivel: {
    type: String,
    enum: ['bronze', 'silver', 'gold', 'platinum'],
    default: 'bronze'
  },
  historicoTransacoes: [transacaoSchema],
  historicoResgates: [resgateSchema]
}, {
  timestamps: true
});

module.exports = mongoose.model('Fidelidade', fidelidadeSchema);