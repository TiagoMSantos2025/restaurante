/**
 * Script para preparar o repositório para deploy no GitHub
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Preparando repositório para GitHub...\n');

// Verificar se estamos no diretório correto
const projectDir = process.cwd();
console.log(`📂 Diretório do projeto: ${projectDir}`);

// Verificar arquivos essenciais para o GitHub
const requiredFiles = [
  'README.md',
  'package.json',
  '.gitignore',
  'server_final.js',
  'DEPLOY.md',
  '.env.example'
];

const missingFiles = [];
requiredFiles.forEach(file => {
  if (!fs.existsSync(file)) {
    missingFiles.push(file);
  }
});

if (missingFiles.length > 0) {
  console.error('❌ Arquivos obrigatórios para o repositório faltando:');
  missingFiles.forEach(file => console.error(`  - ${file}`));
  process.exit(1);
}

console.log('✅ Todos os arquivos obrigatórios estão presentes\n');

// Criar estrutura de diretórios de documentação
const docsDir = 'docs';
if (!fs.existsSync(docsDir)) {
  fs.mkdirSync(docsDir, { recursive: true });
  console.log(`📁 Diretório ${docsDir} criado`);
} else {
  console.log(`📁 Diretório ${docsDir} já existe`);
}

// Criar arquivos de documentação
const docs = {
  'INSTALLATION.md': `# Instalação

## Pré-requisitos

- Node.js (versão 14 ou superior)
- npm (gerenciador de pacotes)

## Passos para Instalação

1. Clone o repositório:
   \`\`\`
   git clone <URL_DO_REPOSITORIO>
   cd sistema-para-restaurantes
   \`\`\`

2. Instale as dependências:
   \`\`\`
   npm install
   \`\`\`

3. Inicie o servidor:
   \`\`\`
   npm start
   \`\`\`

4. Acesse o sistema em:
   \`\`\`
   http://localhost:3000
   \`\`\`
`,

  'CONTRIBUTING.md': `# Contribuindo

## Como Contribuir

1. Faça um fork do projeto
2. Crie uma branch para sua feature (\`git checkout -b feature/NovaFeature\`)
3. Commit suas mudanças (\`git commit -m 'Add some NovaFeature'\`)
4. Push para a branch (\`git push origin feature/NovaFeature\`)
5. Abra um Pull Request
`,

  'LICENSE': `MIT License

Copyright (c) 2024 Sistema de Restaurante

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`
};

Object.entries(docs).forEach(([filename, content]) => {
  const filepath = path.join(docsDir, filename);
  if (!fs.existsSync(filepath)) {
    fs.writeFileSync(filepath, content);
    console.log(`📄 Documento criado: ${docsDir}/${filename}`);
  } else {
    console.log(`📄 Documento já existe: ${docsDir}/${filename}`);
  }
});

// Verificar se o diretório .github existe e criar se necessário
const githubDir = '.github';
if (!fs.existsSync(githubDir)) {
  fs.mkdirSync(githubDir, { recursive: true });
  console.log(`📁 Diretório ${githubDir} criado`);
} else {
  console.log(`📁 Diretório ${githubDir} já existe`);
}

// Criar template para issues
const issueTemplate = `---
name: Relatório de Bug
about: Crie um relatório para nos ajudar a melhorar
title: ''
labels: bug
assignees: ''
---

**Descrição do bug**
Uma descrição clara e concisa do que é o bug.

**Como reproduzir**
Passos para reproduzir o comportamento:
1. Vá para '...'
2. Clique em '....'
3. Veja o erro

**Comportamento esperado**
Uma descrição clara e concisa do que era esperado acontecer.

**Screenshots**
Se aplicável, adicione screenshots para ajudar a explicar seu problema.

**Desktop (por favor complete as seguintes informações):**
 - OS: [ex: iOS]
 - Browser [ex: chrome, safari]
 - Version [ex: 22]

**Contexto adicional**
Adicione qualquer outro contexto sobre o problema aqui.
`;

const issueTemplatePath = path.join(githubDir, 'ISSUE_TEMPLATE');
if (!fs.existsSync(issueTemplatePath)) {
  fs.mkdirSync(issueTemplatePath, { recursive: true });
  fs.writeFileSync(path.join(issueTemplatePath, 'bug_report.md'), issueTemplate);
  console.log(`📄 Template de issue criado: ${issueTemplatePath}/bug_report.md`);
} else {
  console.log(`📄 Template de issue já existe: ${issueTemplatePath}/bug_report.md`);
}

// Criar arquivo de configuração do GitHub
const githubConfig = {
  "version": 1,
  "features": {
    "issues": true,
    "wiki": true,
    "downloads": true
  }
};

fs.writeFileSync(path.join(githubDir, 'config.json'), JSON.stringify(githubConfig, null, 2));
console.log(`📄 Configuração do GitHub criada: ${githubDir}/config.json`);

console.log('\n🎉 Repositório preparado para GitHub!');
console.log('\n📁 Estrutura criada:');
console.log('   ├── docs/');
console.log('   │   ├── INSTALLATION.md');
console.log('   │   ├── CONTRIBUTING.md');
console.log('   │   └── LICENSE');
console.log('   ├── .github/');
console.log('   │   ├── ISSUE_TEMPLATE/'); 
console.log('   │   └── config.json');
console.log('   ├── README.md');
console.log('   ├── package.json');
console.log('   ├── .gitignore');
console.log('   ├── DEPLOY.md');
console.log('   └── .env.example');

console.log('\n🚀 Próximos passos:');
console.log('   1. Inicialize o repositório git: git init');
console.log('   2. Adicione os arquivos: git add .');
console.log('   3. Faça o primeiro commit: git commit -m "Initial commit"');
console.log('   4. Adicione o remote: git remote add origin <URL_DO_REPOSITORIO>');
console.log('   5. Faça push: git push -u origin main');
console.log('   6. O sistema estará pronto para deploy nas plataformas suportadas');