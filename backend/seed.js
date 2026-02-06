const mongoose = require('mongoose');
require('dotenv').config();

// Importar modelos
const Mesa = require('./models/Mesa');
const ItemCardapio = require('./models/ItemCardapio');
const Pedido = require('./models/Pedido');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/restaurante_extradeiro');
    console.log('MongoDB conectado para seed...');
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
};

const seedData = async () => {
  try {
    // Limpar dados antigos
    await Mesa.deleteMany({});
    await ItemCardapio.deleteMany({});
    
    // Criar mesas iniciais (de 1 a 20)
    const mesas = [];
    for (let i = 1; i <= 20; i++) {
      mesas.push({
        numero: i,
        codigoQR: `qr-${i}-${Math.random().toString(36).substr(2, 5)}-${Date.now()}`,
        status: 'disponivel'
      });
    }
    
    await Mesa.insertMany(mesas);
    console.log('Mesas criadas com sucesso!');
    
    // Criar itens de cardápio iniciais
    const itensCardapio = [
      // Lanches
      {
        nome: 'X-Burger',
        descricao: 'Hambúrguer com queijo, alface, tomate e maionese',
        preco: 18.90,
        categoria: 'lanche'
      },
      {
        nome: 'X-Salada',
        descricao: 'Hambúrguer com queijo, alface, tomate, cebola e maionese',
        preco: 20.90,
        categoria: 'lanche'
      },
      {
        nome: 'Cachorro Quente',
        descricao: 'Salsicha com pão, molho, maionese, ketchup e mostarda',
        preco: 12.90,
        categoria: 'lanche'
      },
      {
        nome: 'Misto Quente',
        descricao: 'Sanduíche com presunto e queijo',
        preco: 8.90,
        categoria: 'lanche'
      },
      
      // Pizzas
      {
        nome: 'Pizza Calabresa',
        descricao: 'Molho de tomate, mussarela, calabresa fatiada e cebola',
        preco: 45.90,
        categoria: 'pizza'
      },
      {
        nome: 'Pizza Mussarela',
        descricao: 'Molho de tomate e mussarela',
        preco: 42.90,
        categoria: 'pizza'
      },
      {
        nome: 'Pizza Pepperoni',
        descricao: 'Molho de tomate, mussarela e pepperoni',
        preco: 52.90,
        categoria: 'pizza'
      },
      {
        nome: 'Pizza Margherita',
        descricao: 'Molho de tomate, mussarela e manjericão fresco',
        preco: 48.90,
        categoria: 'pizza'
      },
      
      // Bebidas
      {
        nome: 'Refrigerante Lata',
        descricao: 'Coca-Cola, Fanta, Guaraná Antarctica (350ml)',
        preco: 6.90,
        categoria: 'bebida'
      },
      {
        nome: 'Água Mineral',
        descricao: 'Sem gás (500ml)',
        preco: 3.90,
        categoria: 'bebida'
      },
      {
        nome: 'Suco Natural',
        descricao: 'Laranja, limão, maracujá (300ml)',
        preco: 8.90,
        categoria: 'bebida'
      },
      {
        nome: 'Cerveja Lata',
        descricao: 'Skol, Brahma, Heineken (350ml)',
        preco: 7.90,
        categoria: 'bebida'
      },
      
      // Sobremesas
      {
        nome: 'Sorvete',
        descricao: 'Sabor chocolate, morango ou creme (bola)',
        preco: 6.90,
        categoria: 'sobremesa'
      },
      {
        nome: 'Brownie',
        descricao: 'Brownie com sorvete de baunilha',
        preco: 14.90,
        categoria: 'sobremesa'
      }
    ];
    
    await ItemCardapio.insertMany(itensCardapio);
    console.log('Itens de cardápio criados com sucesso!');
    
    process.exit(0);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
};

connectDB().then(() => {
  seedData();
});