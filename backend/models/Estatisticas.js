const mongoose = require('mongoose');

const EstatisticasSchema = new mongoose.Schema({
  periodo: { type: String, required: true }, // 'diario', 'semanal', 'mensal', 'anual'
  dataReferencia: { type: Date, required: true },
  vendasTotais: { type: Number, default: 0 },
  pedidosTotais: { type: Number, default: 0 },
  ticketMedio: { type: Number, default: 0 },
  itensMaisVendidos: [{
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'ItemCardapio' },
    nomeItem: { type: String },
    quantidade: { type: Number }
  }],
  receitaPorCategoria: [{
    categoria: { type: String },
    receita: { type: Number }
  }],
  horariosPico: [{
    hora: { type: Number }, // 0-23
    pedidos: { type: Number }
  }]
}, { timestamps: true });

module.exports = mongoose.model('Estatisticas', EstatisticasSchema);