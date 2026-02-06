const mongoose = require('mongoose');
require('dotenv').config();
const Usuario = require('./models/Usuario');
const Restaurante = require('./models/Restaurante');
const bcrypt = require('bcryptjs');

// Conectar ao banco de dados
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sistema_restaurante', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

async function setupAdmin() {
  try {
    // Verificar se já existe um administrador
    const existingAdmin = await Usuario.findOne({ role: 'admin' });
    
    if (existingAdmin) {
      console.log('Administrador já existe. Setup concluído.');
      process.exit(0);
    }
    
    // Criar administrador padrão
    const hashedPassword = await bcrypt.hash('admin123', 10); // Senha padrão: admin123
    
    const admin = new Usuario({
      name: 'Administrador',
      email: 'admin@sistemarestaurante.com',
      password: hashedPassword,
      role: 'admin'
    });
    
    await admin.save();
    
    console.log('Administrador padrão criado com sucesso!');
    console.log('Email: admin@sistemarestaurante.com');
    console.log('Senha: admin123');
    
    process.exit(0);
  } catch (error) {
    console.error('Erro ao configurar administrador:', error);
    process.exit(1);
  }
}

setupAdmin();