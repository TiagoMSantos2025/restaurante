const mongoose = require('mongoose');

const PedidoItemSchema = new mongoose.Schema({
  item: { type: mongoose.Schema.Types.ObjectId, ref: 'ItemCardapio', required: true },
  quantidade: { type: Number, required: true },
  observacoes: { type: String }
});

const PedidoSchema = new mongoose.Schema({
  mesa: { type: mongoose.Schema.Types.ObjectId, ref: 'Mesa', required: true },
  cliente: { type: String, required: true },
  itens: [PedidoItemSchema],
  status: { 
    type: String, 
    enum: ['recebido', 'confirmado', 'preparando', 'pronto', 'entregue'], 
    default: 'recebido' 
  },
  valorTotal: { type: Number, required: true },
  dataPedido: { type: Date, default: Date.now },
  dataConfirmacao: { type: Date },
  dataEntrega: { type: Date }
});

module.exports = mongoose.model('Pedido', PedidoSchema);