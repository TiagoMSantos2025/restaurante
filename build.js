/**
 * Script de build para preparar o sistema para produção
 */

const fs = require('fs');
const path = require('path');

console.log('🏗️  Iniciando build para produção...\n');

// Verificar se está no diretório correto
const projectDir = process.cwd();
console.log(`📂 Diretório do projeto: ${projectDir}`);

// Definir modo de produção
process.env.NODE_ENV = 'production';
console.log(`⚙️  Modo de ambiente definido para: ${process.env.NODE_ENV}\n`);

// Criar estrutura de diretórios para produção
const productionDirs = [
  'dist',
  'dist/public',
  'dist/views',
  'dist/backups'
];

productionDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Diretório criado: ${dir}`);
  } else {
    console.log(`📁 Diretório já existe: ${dir}`);
  }
});

// Copiar arquivos estáticos
const staticFiles = {
  'public': 'dist/public',
  'views': 'dist/views'
};

Object.entries(staticFiles).forEach(([source, dest]) => {
  if (fs.existsSync(source)) {
    copyDirectoryRecursive(source, dest);
    console.log(`📄 Arquivos copiados de ${source} para ${dest}`);
  } else {
    console.warn(`⚠️  Diretório não encontrado: ${source}`);
  }
});

// Função para copiar diretórios recursivamente
function copyDirectoryRecursive(src, dest) {
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (let entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyDirectoryRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Copiar arquivos importantes para produção
const importantFiles = [
  'package.json',
  'server_final.js',
  'Procfile',
  'netlify.toml',
  'railway.toml',
  'app.json',
  'README.md',
  'DEPLOY.md',
  '.env.example'
];

importantFiles.forEach(file => {
  if (fs.existsSync(file)) {
    fs.copyFileSync(file, path.join('dist', file));
    console.log(`📄 Arquivo copiado: ${file}`);
  } else {
    console.log(`📝 Arquivo opcional não encontrado: ${file}`);
  }
});

// Criar arquivo de configuração de produção
const productionConfig = {
  version: require('./package.json').version,
  buildDate: new Date().toISOString(),
  environment: 'production',
  features: [
    'qr_ordering',
    'kds_panel',
    'admin_dashboard',
    'stock_control',
    'customer_registration',
    'order_reviews',
    'booking_system',
    'automatic_backups'
  ]
};

fs.writeFileSync(
  path.join('dist', 'config.json'),
  JSON.stringify(productionConfig, null, 2)
);

console.log('\n⚙️  Configuração de produção criada: dist/config.json');

// Verificar dependências
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const dependencies = Object.keys(packageJson.dependencies || {});

console.log(`\n📦 Dependências identificadas: ${dependencies.length}`);
dependencies.forEach(dep => {
  console.log(`   - ${dep}: ${packageJson.dependencies[dep]}`);
});

// Criar arquivo de manifesto
const manifest = {
  name: packageJson.name,
  version: packageJson.version,
  description: packageJson.description,
  build: {
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    platform: process.platform
  },
  files: fs.readdirSync('dist', { recursive: true }).filter(f => 
    typeof f === 'string'
  )
};

fs.writeFileSync(
  path.join('dist', 'MANIFEST.json'),
  JSON.stringify(manifest, null, 2)
);

console.log('\n📋 Manifesto de build criado: dist/MANIFEST.json');

// Mensagem final
console.log('\n🎉 Build concluído com sucesso!');
console.log('\n📁 Pasta de distribuição criada em: ./dist/');
console.log('\n🚀 Próximos passos:');
console.log('   1. Verifique os arquivos em ./dist/');
console.log('   2. Faça upload dos arquivos para sua plataforma de hospedagem');
console.log('   3. Configure as variáveis de ambiente conforme .env.example');
console.log('   4. Execute npm install no ambiente de destino');
console.log('   5. Inicie o servidor com npm start');

// Para deploy em algumas plataformas, talvez seja necessário renomear o servidor
if (!fs.existsSync('dist/server.js') && fs.existsSync('dist/server_final.js')) {
  fs.copyFileSync('dist/server_final.js', 'dist/server.js');
  console.log('\n🔗 Arquivo do servidor renomeado para compatibilidade: dist/server.js');
}