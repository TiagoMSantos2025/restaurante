const Fidelidade = require('../models/Fidelidade');

class FidelidadeService {
  constructor() {
    // Inicializa regras de negócio para o programa de fidelidade
    this.config = {
      pontosPorReal: 1, // 1 ponto por cada R$1 gasto
      niveis: {
        bronze: { limite: 0, beneficios: [] },
        silver: { limite: 500, beneficios: ['5% de desconto'] },
        gold: { limite: 1000, beneficios: ['10% de desconto', 'Bebida grátis'] },
        platinum: { limite: 2000, beneficios: ['15% de desconto', 'Sobremesa grátis', 'Prioridade no atendimento'] }
      },
      recompensas: [
        { id: 1, nome: 'Desconto 10%', pontos: 500, tipo: 'desconto', valor: 10 },
        { id: 2, nome: 'Bebida Grátis', pontos: 800, tipo: 'produto', produto: 'bebida' },
        { id: 3, nome: 'Sobremesa Grátis', pontos: 1200, tipo: 'produto', produto: 'sobremesa' }
      ]
    };
  }

  /**
   * Registra ganho de pontos para um cliente
   * @param {string} userId - ID do usuário
   * @param {number} valorCompra - Valor da compra para calcular pontos
   * @param {string} descricao - Descrição da transação
   * @returns {Promise<Object>} - Perfil de fidelidade atualizado
   */
  async registrarGanhoPontos(userId, valorCompra, descricao = '') {
    try {
      // Calcula pontos ganhos
      const pontosGanhos = Math.floor(valorCompra * this.config.pontosPorReal);
      
      // Busca ou cria perfil de fidelidade
      let perfil = await Fidelidade.findOne({ userId });
      
      if (!perfil) {
        perfil = new Fidelidade({
          userId,
          pontosAcumulados: 0,
          historicoTransacoes: []
        });
      }
      
      // Atualiza pontos
      perfil.pontosAcumulados += pontosGanhos;
      
      // Adiciona transação ao histórico
      perfil.historicoTransacoes.push({
        tipo: 'ganho',
        pontos: pontosGanhos,
        descricao,
        valorReferencia: valorCompra,
        data: new Date()
      });
      
      // Determina nível atual
      perfil.nivel = this.calcularNivel(perfil.pontosAcumulados);
      
      await perfil.save();
      
      return perfil;
    } catch (error) {
      console.error('Erro ao registrar ganho de pontos:', error);
      throw error;
    }
  }

  /**
   * Calcula o nível de fidelidade com base nos pontos acumulados
   * @param {number} pontos - Pontos acumulados
   * @returns {string} - Nível de fidelidade
   */
  calcularNivel(pontos) {
    if (pontos >= this.config.niveis.platinum.limite) return 'platinum';
    if (pontos >= this.config.niveis.gold.limite) return 'gold';
    if (pontos >= this.config.niveis.silver.limite) return 'silver';
    return 'bronze';
  }

  /**
   * Resgata uma recompensa usando pontos
   * @param {string} userId - ID do usuário
   * @param {number} recompensaId - ID da recompensa a ser resgatada
   * @returns {Promise<Object>} - Resultado do resgate
   */
  async resgatarRecompensa(userId, recompensaId) {
    try {
      const perfil = await Fidelidade.findOne({ userId });
      if (!perfil) {
        throw new Error('Perfil de fidelidade não encontrado');
      }

      // Encontra a recompensa
      const recompensa = this.config.recompensas.find(r => r.id === recompensaId);
      if (!recompensa) {
        throw new Error('Recompensa não encontrada');
      }

      // Verifica se o usuário tem pontos suficientes
      if (perfil.pontosAcumulados < recompensa.pontos) {
        throw new Error('Pontos insuficientes para resgatar esta recompensa');
      }

      // Deduz os pontos
      perfil.pontosAcumulados -= recompensa.pontos;

      // Adiciona resgate ao histórico
      perfil.historicoResgates.push({
        recompensaId: recompensa.id,
        nomeRecompensa: recompensa.nome,
        pontosUtilizados: recompensa.pontos,
        data: new Date()
      });

      // Atualiza nível após dedução de pontos
      perfil.nivel = this.calcularNivel(perfil.pontosAcumulados);

      await perfil.save();

      return {
        success: true,
        message: `Recompensa "${recompensa.nome}" resgatada com sucesso!`,
        pontosAtualizados: perfil.pontosAcumulados,
        recompensa
      };
    } catch (error) {
      console.error('Erro ao resgatar recompensa:', error);
      throw error;
    }
  }

  /**
   * Obtem o perfil de fidelidade de um usuário
   * @param {string} userId - ID do usuário
   * @returns {Promise<Object>} - Perfil de fidelidade
   */
  async obterPerfil(userId) {
    try {
      let perfil = await Fidelidade.findOne({ userId });
      
      if (!perfil) {
        // Cria perfil padrão se não existir
        perfil = new Fidelidade({
          userId,
          pontosAcumulados: 0,
          nivel: 'bronze',
          historicoTransacoes: [],
          historicoResgates: []
        });
        await perfil.save();
      }

      // Adiciona informações calculadas
      perfil = perfil.toObject();
      perfil.nivelAtual = this.calcularNivel(perfil.pontosAcumulados);
      perfil.proximoNivel = this.obterProximoNivel(perfil.pontosAcumulados);
      perfil.pontosParaProximoNivel = this.obterPontosParaProximoNivel(perfil.pontosAcumulados);
      perfil.recompensasDisponiveis = this.obterRecompensasDisponiveis(perfil.pontosAcumulados);
      perfil.beneficiosNivel = this.obterBeneficiosNivel(perfil.nivelAtual);

      return perfil;
    } catch (error) {
      console.error('Erro ao obter perfil de fidelidade:', error);
      throw error;
    }
  }

  /**
   * Obtem o próximo nível com base nos pontos atuais
   * @param {number} pontos - Pontos acumulados
   * @returns {string|null} - Próximo nível ou null se já for platinum
   */
  obterProximoNivel(pontos) {
    const niveis = Object.keys(this.config.niveis).reverse();
    const nivelAtualIdx = niveis.indexOf(this.calcularNivel(pontos));
    
    if (nivelAtualIdx > 0) {
      return niveis[nivelAtualIdx - 1]; // Retorna o próximo nível
    }
    return null; // Já está em platinum
  }

  /**
   * Calcula quantos pontos faltam para o próximo nível
   * @param {number} pontos - Pontos acumulados
   * @returns {number} - Pontos necessários para o próximo nível
   */
  obterPontosParaProximoNivel(pontos) {
    const nivelAtual = this.calcularNivel(pontos);
    const proximoNivel = this.obterProximoNivel(pontos);
    
    if (!proximoNivel) {
      return 0; // Já está no nível máximo
    }

    const limiteProximoNivel = this.config.niveis[proximoNivel].limite;
    return limiteProximoNivel - pontos;
  }

  /**
   * Obtem recompensas disponíveis com base nos pontos atuais
   * @param {number} pontos - Pontos acumulados
   * @returns {Array} - Lista de recompensas disponíveis
   */
  obterRecompensasDisponiveis(pontos) {
    return this.config.recompensas
      .filter(recompensa => pontos >= recompensa.pontos)
      .map(recompensa => ({
        ...recompensa,
        disponivel: true
      }));
  }

  /**
   * Obtem benefícios do nível atual
   * @param {string} nivel - Nível de fidelidade
   * @returns {Array} - Lista de benefícios
   */
  obterBeneficiosNivel(nivel) {
    return this.config.niveis[nivel]?.beneficios || [];
  }

  /**
   * Aplica benefício de fidelidade a um pedido
   * @param {Object} pedido - Objeto do pedido
   * @param {string} userId - ID do usuário
   * @returns {Promise<Object>} - Pedido com benefícios aplicados
   */
  async aplicarBeneficios(pedido, userId) {
    try {
      const perfil = await this.obterPerfil(userId);
      const nivel = perfil.nivelAtual;
      const beneficios = this.obterBeneficiosNivel(nivel);

      let pedidoComBeneficios = { ...pedido };

      // Aplica benefícios com base no nível
      if (beneficios.includes('5% de desconto') && pedido.total >= 50) {
        pedidoComBeneficios.desconto = pedidoComBeneficios.desconto || 0;
        pedidoComBeneficios.desconto += pedido.total * 0.05;
      } else if (beneficios.includes('10% de desconto') && pedido.total >= 75) {
        pedidoComBeneficios.desconto = pedidoComBeneficios.desconto || 0;
        pedidoComBeneficios.desconto += pedido.total * 0.10;
      } else if (beneficios.includes('15% de desconto') && pedido.total >= 100) {
        pedidoComBeneficios.desconto = pedidoComBeneficios.desconto || 0;
        pedidoComBeneficios.desconto += pedido.total * 0.15;
      }

      pedidoComBeneficios.totalComBeneficios = pedido.total - (pedidoComBeneficios.desconto || 0);

      return pedidoComBeneficios;
    } catch (error) {
      console.error('Erro ao aplicar benefícios de fidelidade:', error);
      return pedido; // Retorna pedido original em caso de erro
    }
  }
}

module.exports = new FidelidadeService();