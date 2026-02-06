const mongoose = require('mongoose');

const HistoricoPedidoSchema = new mongoose.Schema({
  usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' }, // ID do cliente que fez o pedido
  mesa: { type: mongoose.Schema.Types.ObjectId, ref: 'Mesa', required: true },
  cliente: { type: String, required: true },
  itens: [{
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'ItemCardapio', required: true },
    quantidade: { type: Number, required: true },
    observacoes: { type: String }
  }],
  status: { 
    type: String, 
    enum: ['recebido', 'confirmado', 'preparando', 'pronto', 'entregue', 'cancelado'], 
    default: 'recebido' 
  },
  valorTotal: { type: Number, required: true },
  dataPedido: { type: Date, default: Date.now },
  dataConfirmacao: { type: Date },
  dataEntrega: { type: Date },
  ativo: { type: Boolean, default: true } // Para soft delete
});

// Índices para melhorar performance de consultas
HistoricoPedidoSchema.index({ usuarioId: 1, dataPedido: -1 });
HistoricoPedidoSchema.index({ mesa: 1, dataPedido: -1 });
HistoricoPedidoSchema.index({ status: 1 });

module.exports = mongoose.model('HistoricoPedido', HistoricoPedidoSchema);