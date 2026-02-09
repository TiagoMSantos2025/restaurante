const mysql = require('mysql2');

// Configurações do banco de dados
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '', // Senha vazia para XAMPP padrão
};

console.log('Conectando ao MySQL para criar o banco de dados...');

// Conectar sem especificar o banco de dados
const connection = mysql.createConnection(dbConfig);

// Ler o conteúdo do arquivo SQL
const fs = require('fs');
const sqlContent = fs.readFileSync('./database.sql', 'utf8');

connection.connect((err) => {
  if (err) {
    console.error('Erro ao conectar ao MySQL:', err);
    process.exit(1);
  }
  
  console.log('Conexão bem-sucedida ao MySQL!');
  
  // Executar o script SQL para criar o banco de dados e tabelas
  connection.query(sqlContent, (err, results) => {
    if (err) {
      console.error('Erro ao executar o script SQL:', err);
      connection.end();
      process.exit(1);
    }
    
    console.log('Banco de dados e tabelas criados com sucesso!');
    console.log('Total de resultados:', results.length || 'N/A');
    
    // Fechar conexão
    connection.end((err) => {
      if (err) {
        console.error('Erro ao fechar conexão:', err);
      } else {
        console.log('Conexão fechada com sucesso!');
      }
    });
  });
});