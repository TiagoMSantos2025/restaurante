/**
 * Script para preparar o sistema para deploy em produção
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Preparando sistema para deploy em produção...');

// Verificar se os arquivos necessários para deploy existem
const requiredFiles = [
  'package.json',
  'Procfile',
  'app.json',
  'netlify.toml',
  'railway.toml',
  'DEPLOY.md',
  'server_final.js'
];

const missingFiles = [];
requiredFiles.forEach(file => {
  if (!fs.existsSync(file)) {
    missingFiles.push(file);
  }
});

if (missingFiles.length > 0) {
  console.error('❌ Arquivos obrigatórios para deploy faltando:');
  missingFiles.forEach(file => console.error(`  - ${file}`));
  process.exit(1);
}

console.log('✅ Todos os arquivos necessários para deploy estão presentes');

// Verificar dependências
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const dependencies = Object.keys(packageJson.dependencies || {});
const devDependencies = Object.keys(packageJson.devDependencies || {});

console.log(`📦 Dependências instaladas: ${dependencies.length}`);
console.log(`🧪 Dependências de desenvolvimento: ${devDependencies.length}`);

// Verificar se o script de início está configurado
if (!packageJson.scripts || !packageJson.scripts.start) {
  console.error('❌ Script de início (start) não encontrado no package.json');
  process.exit(1);
}

console.log('✅ Script de início configurado corretamente');

// Criar pasta dist para possíveis builds
if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist', { recursive: true });
  console.log('📁 Pasta dist criada para builds');
} else {
  console.log('📁 Pasta dist já existe');
}

// Verificar se as pastas públicas existem
const publicFolders = ['public', 'views'];
publicFolders.forEach(folder => {
  if (!fs.existsSync(folder)) {
    console.warn(`⚠️  Pasta ${folder} não encontrada`);
  } else {
    console.log(`✅ Pasta ${folder} encontrada`);
  }
});

// Gerar arquivo de configuração de ambiente
const envExample = `# Configurações de ambiente para produção
PORT=3000
NODE_ENV=production
# Para PostgreSQL em produção
# DATABASE_URL=postgresql://user:password@host:port/database
# Para MySQL em produção
# DATABASE_URL=mysql://user:password@host:port/database
`;

if (!fs.existsSync('.env.example')) {
  fs.writeFileSync('.env.example', envExample);
  console.log('📄 Arquivo .env.example criado');
} else {
  console.log('📄 Arquivo .env.example já existe');
}

// Verificar se o servidor está configurado para usar porta dinâmica
let serverCode = fs.readFileSync('server_final.js', 'utf8');
if (!serverCode.includes('process.env.PORT')) {
  // Modificar o código para usar porta dinâmica
  serverCode = serverCode.replace(
    /const PORT = process\.env\.PORT \|\| 3000;/,
    'const PORT = process.env.PORT || 3000;'
  );
  
  if (!serverCode.includes('process.env.PORT')) {
    // Caso não encontre o padrão exato, adicionar a configuração
    serverCode = serverCode.replace(
      /const PORT = .*\n/,
      'const PORT = process.env.PORT || 3000;\n'
    );
  }
  
  fs.writeFileSync('server_final.js', serverCode);
  console.log('🔧 Configuração de porta dinâmica atualizada');
} else {
  console.log('🔧 Configuração de porta dinâmica já está presente');
}

console.log('\n🎉 Sistema preparado para deploy em produção!');
console.log('\n🚀 Próximos passos:');
console.log('   1. Configure as variáveis de ambiente');
console.log('   2. Verifique as configurações de banco de dados');
console.log('   3. Teste localmente com NODE_ENV=production');
console.log('   4. Faça o deploy para sua plataforma escolhida');
console.log('   5. Consulte DEPLOY.md para instruções detalhadas');