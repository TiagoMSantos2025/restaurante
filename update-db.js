const sqlite3 = require('sqlite3').verbose();

// Abrir o banco de dados
const db = new sqlite3.Database('restaurante.db');

// Função para adicionar colunas
function addColumnIfNotExists(tableName, columnName, columnDefinition) {
    return new Promise((resolve, reject) => {
        // Verificar se a coluna já existe
        db.all(`PRAGMA table_info(${tableName})`, (err, rows) => {
            if (err) {
                reject(err);
                return;
            }
            
            const columnExists = rows.some(row => row.name === columnName);
            
            if (columnExists) {
                console.log(`Coluna ${columnName} já existe na tabela ${tableName}`);
                resolve();
            } else {
                // Adicionar a coluna
                const sql = `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`;
                db.run(sql, (err) => {
                    if (err) {
                        console.error(`Erro ao adicionar coluna ${columnName}:`, err.message);
                        reject(err);
                    } else {
                        console.log(`Coluna ${columnName} adicionada com sucesso à tabela ${tableName}`);
                        resolve();
                    }
                });
            }
        });
    });
}

// Atualizar o banco de dados
async function updateDatabase() {
    try {
        // Adicionar as colunas necessárias à tabela produtos
        await addColumnIfNotExists('produtos', 'ingredientes', 'TEXT');
        await addColumnIfNotExists('produtos', 'tipo', "TEXT DEFAULT 'comida'");
        
        console.log('Atualização do banco de dados concluída com sucesso!');
        
        // Verificar as colunas
        db.all('PRAGMA table_info(produtos)', (err, rows) => {
            if (err) {
                console.error('Erro ao verificar colunas:', err);
            } else {
                console.log('\nEstrutura atual da tabela produtos:');
                rows.forEach(row => {
                    console.log(`${row.name}: ${row.type}${row.dflt_value ? ' DEFAULT ' + row.dflt_value : ''}`);
                });
            }
            
            db.close();
        });
    } catch (error) {
        console.error('Erro durante a atualização:', error);
        db.close();
    }
}

// Executar a atualização
updateDatabase();