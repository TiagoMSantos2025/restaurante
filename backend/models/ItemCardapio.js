const mongoose = require('mongoose');

const AvaliacaoSchema = new mongoose.Schema({
  usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' },
  nota: { type: Number, required: true, min: 1, max: 5 },
  comentario: { type: String },
  dataAvaliacao: { type: Date, default: Date.now }
});

const ItemCardapioSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  descricao: { type: String },
  preco: { type: Number, required: true },
  categoria: { type: String, required: true }, // lanche, pizza, bebida, etc
  imagem: { type: String },
  avaliacoes: [AvaliacaoSchema],
  mediaAvaliacoes: { type: Number, default: 0 } // Média calculada das avaliações
});

module.exports = mongoose.model('ItemCardapio', ItemCardapioSchema);