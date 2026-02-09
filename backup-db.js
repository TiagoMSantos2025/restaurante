const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// Função para criar backup do banco de dados
function createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `restaurante_backup_${timestamp}.db`;
    const backupPath = path.join(__dirname, 'backups', backupFileName);
    
    // Criar pasta de backups se não existir
    if (!fs.existsSync(path.join(__dirname, 'backups'))) {
        fs.mkdirSync(path.join(__dirname, 'backups'), { recursive: true });
    }
    
    const db = new sqlite3.Database('restaurante.db');
    const backupDB = new sqlite3.Database(backupPath);
    
    console.log(`Iniciando backup: ${backupFileName}`);
    
    // Copiar o conteúdo do banco de dados para o backup
    db.backup(backupDB, (err) => {
        if (err) {
            console.error('Erro ao criar backup:', err);
        } else {
            console.log(`Backup criado com sucesso: ${backupPath}`);
            
            // Manter apenas os últimos 10 backups
            cleanupOldBackups();
        }
        
        db.close();
        backupDB.close();
    });
}

// Função para limpar backups antigos (manter apenas os 10 mais recentes)
function cleanupOldBackups() {
    try {
        const backupDir = path.join(__dirname, 'backups');
        if (!fs.existsSync(backupDir)) {
            return;
        }
        
        const files = fs.readdirSync(backupDir)
            .filter(file => file.startsWith('restaurante_backup_') && file.endsWith('.db'))
            .map(file => {
                return {
                    name: file,
                    time: fs.statSync(path.join(backupDir, file)).mtime.getTime()
                };
            })
            .sort((a, b) => b.time - a.time);
        
        // Remover backups antigos (manter apenas os 10 mais recentes)
        for (let i = 10; i < files.length; i++) {
            const filePath = path.join(backupDir, files[i].name);
            fs.unlinkSync(filePath);
            console.log(`Backup antigo removido: ${filePath}`);
        }
    } catch (error) {
        console.error('Erro ao limpar backups antigos:', error);
    }
}

// Executar backup imediatamente se chamado diretamente
if (require.main === module) {
    createBackup();
}

module.exports = { createBackup, cleanupOldBackups };