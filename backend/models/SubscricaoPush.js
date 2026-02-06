const mongoose = require('mongoose');

const SubscricaoPushSchema = new mongoose.Schema({
  usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  endpoint: { type: String, required: true },
  keys: {
    auth: { type: String, required: true },
    p256dh: { type: String, required: true }
  },
  tipo: { type: String, enum: ['balcao', 'cozinha', 'cliente'], required: true },
  ativo: { type: Boolean, default: true },
  dataRegistro: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SubscricaoPush', SubscricaoPushSchema);