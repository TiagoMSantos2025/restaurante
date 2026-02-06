const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const AdmZip = require('adm-zip');

const execAsync = promisify(exec);

class BackupService {
  /**
   * Cria um backup do banco de dados MongoDB
   * @param {string} dbName - Nome do banco de dados
   * @param {string} outputPath - Caminho para salvar o backup
   * @returns {Promise<string>} - Caminho do arquivo de backup criado
   */
  static async criarBackupBD(dbName, outputPath) {
    try {
      // Verificar se mongodump está instalado
      const { stdout } = await execAsync('mongodump --version');
      if (!stdout.includes('mongodump')) {
        throw new Error('mongodump não encontrado. MongoDB tools devem estar instalados.');
      }

      // Criar diretório de saída se não existir
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Executar mongodump
      const dumpPath = path.join(outputDir, 'dump');
      await execAsync(`mongodump --db ${dbName} --out ${dumpPath}`);

      // Compactar o diretório dump em um arquivo zip
      const zip = new AdmZip();
      zip.addLocalFolder(dumpPath);
      zip.writeZip(outputPath);

      // Remover diretório temporário dump
      await execAsync(`rm -rf ${dumpPath}`);

      console.log(`Backup do BD criado com sucesso: ${outputPath}`);
      return outputPath;
    } catch (error) {
      console.error('Erro ao criar backup do BD:', error);
      throw error;
    }
  }

  /**
   * Cria um backup dos arquivos importantes do sistema
   * @param {string} outputPath - Caminho para salvar o backup
   * @param {string[]} includePaths - Caminhos para incluir no backup
   * @returns {Promise<string>} - Caminho do arquivo de backup criado
   */
  static async criarBackupArquivos(outputPath, includePaths = []) {
    try {
      const zip = new AdmZip();

      // Adicionar caminhos específicos ao backup
      for (const filePath of includePaths) {
        if (fs.existsSync(filePath)) {
          if (fs.lstatSync(filePath).isDirectory()) {
            zip.addLocalFolder(filePath, path.basename(filePath));
          } else {
            zip.addLocalFile(filePath);
          }
        }
      }

      // Criar diretório de saída se não existir
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      zip.writeZip(outputPath);

      console.log(`Backup de arquivos criado com sucesso: ${outputPath}`);
      return outputPath;
    } catch (error) {
      console.error('Erro ao criar backup de arquivos:', error);
      throw error;
    }
  }

  /**
   * Cria um backup completo do sistema (BD + arquivos)
   * @param {string} backupDir - Diretório para salvar os backups
   * @param {string} dbName - Nome do banco de dados
   * @returns {Promise<{bdPath: string, arquivosPath: string}>} - Caminhos dos backups criados
   */
  static async criarBackupCompleto(backupDir, dbName) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const bdPath = path.join(backupDir, `backup_bd_${timestamp}.zip`);
      const arquivosPath = path.join(backupDir, `backup_arquivos_${timestamp}.zip`);

      // Garantir que o diretório de backup exista
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      // Criar backup do BD
      await this.criarBackupBD(dbName, bdPath);

      // Criar backup dos arquivos importantes
      const arquivosImportantes = [
        path.join(__dirname, '../models'),
        path.join(__dirname, '../public'),
        path.join(__dirname, '../middleware'),
        path.join(__dirname, '../services'),
        path.join(__dirname, '../utils'),
        path.join(__dirname, '../server.js'),
        path.join(__dirname, '../package.json'),
        path.join(__dirname, '../.env')
      ];

      await this.criarBackupArquivos(arquivosPath, arquivosImportantes);

      console.log('Backup completo criado com sucesso');
      return { bdPath, arquivosPath };
    } catch (error) {
      console.error('Erro ao criar backup completo:', error);
      throw error;
    }
  }

  /**
   * Programa backups automáticos regulares
   * @param {number} intervaloHoras - Intervalo em horas entre backups
   * @param {string} backupDir - Diretório para salvar os backups
   * @param {string} dbName - Nome do banco de dados
   */
  static programarBackups(intervaloHoras, backupDir, dbName) {
    const intervaloMs = intervaloHoras * 60 * 60 * 1000;

    console.log(`Programando backups a cada ${intervaloHoras} horas...`);

    // Executar backup imediatamente
    this.criarBackupCompleto(backupDir, dbName).catch(console.error);

    // Executar backups regulares
    setInterval(async () => {
      try {
        console.log(`Iniciando backup automático às ${new Date().toISOString()}`);
        await this.criarBackupCompleto(backupDir, dbName);
      } catch (error) {
        console.error('Erro no backup automático:', error);
      }
    }, intervaloMs);
  }

  /**
   * Limpa backups antigos mantendo apenas os mais recentes
   * @param {string} backupDir - Diretório onde estão os backups
   * @param {number} diasParaManter - Número de dias para manter backups
   */
  static async limparBackupsAntigos(backupDir, diasParaManter = 30) {
    try {
      const files = fs.readdirSync(backupDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - diasParaManter);

      for (const file of files) {
        const filePath = path.join(backupDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.isFile() && stats.mtime < cutoffDate) {
          fs.unlinkSync(filePath);
          console.log(`Backup antigo removido: ${filePath}`);
        }
      }
    } catch (error) {
      console.error('Erro ao limpar backups antigos:', error);
      throw error;
    }
  }
}

module.exports = BackupService;