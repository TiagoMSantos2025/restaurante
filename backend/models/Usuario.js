const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const UsuarioSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  senha: { type: String, required: true },
  tipo: { 
    type: String, 
    enum: ['admin', 'gerente', 'balcao', 'cozinha', 'cliente'], 
    default: 'cliente' 
  },
  ativo: { type: Boolean, default: true },
  favoritos: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ItemCardapio' }], // Adicionando lista de favoritos
  dataRegistro: { type: Date, default: Date.now }
});

// Hash da senha antes de salvar
UsuarioSchema.pre('save', async function(next) {
  if (!this.isModified('senha')) return next();
  this.senha = await bcrypt.hash(this.senha, 12);
  next();
});

// Método para comparar senhas
UsuarioSchema.methods.compararSenha = async function(senha) {
  return await bcrypt.compare(senha, this.senha);
};

module.exports = mongoose.model('Usuario', UsuarioSchema);