const mongoose = require('mongoose');

const MesaSchema = new mongoose.Schema({
  numero: { type: Number, required: true, unique: true },
  status: { type: String, enum: ['disponivel', 'ocupada'], default: 'disponivel' },
  codigoQR: { type: String, required: true, unique: true },
  cliente: { type: String },
  pedidoAtual: { type: mongoose.Schema.Types.ObjectId, ref: 'Pedido' }
});

module.exports = mongoose.model('Mesa', MesaSchema);