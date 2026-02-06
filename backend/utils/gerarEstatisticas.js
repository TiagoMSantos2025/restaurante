const mongoose = require('mongoose');
const Pedido = require('../models/Pedido');
const ItemCardapio = require('../models/ItemCardapio');
const Estatisticas = require('../models/Estatisticas');

/**
 * Gera estatísticas diárias, semanais ou mensais com base no período especificado
 * @param {string} periodo - 'diario', 'semanal' ou 'mensal'
 * @param {Date} dataReferencia - Data de referência para o cálculo
 */
const gerarEstatisticas = async (periodo, dataReferencia = new Date()) => {
  try {
    // Calcular datas de início e fim com base no período
    let dataInicio, dataFim;
    
    switch(periodo) {
      case 'diario':
        dataInicio = new Date(dataReferencia);
        dataInicio.setHours(0, 0, 0, 0); // Início do dia
        dataFim = new Date(dataReferencia);
        dataFim.setHours(23, 59, 59, 999); // Fim do dia
        break;
        
      case 'semanal':
        dataInicio = new Date(dataReferencia);
        dataInicio.setDate(dataReferencia.getDate() - dataReferencia.getDay()); // Domingo da semana
        dataInicio.setHours(0, 0, 0, 0);
        dataFim = new Date(dataInicio);
        dataFim.setDate(dataInicio.getDate() + 6); // Sábado da semana
        dataFim.setHours(23, 59, 59, 999);
        break;
        
      case 'mensal':
        dataInicio = new Date(dataReferencia.getFullYear(), dataReferencia.getMonth(), 1);
        dataInicio.setHours(0, 0, 0, 0);
        dataFim = new Date(dataReferencia.getFullYear(), dataReferencia.getMonth() + 1, 0);
        dataFim.setHours(23, 59, 59, 999);
        break;
        
      default:
        throw new Error('Período inválido. Use "diario", "semanal" ou "mensal".');
    }
    
    // Buscar pedidos no período
    const pedidos = await Pedido.find({
      dataPedido: {
        $gte: dataInicio,
        $lte: dataFim
      },
      status: { $in: ['entregue', 'concluido'] } // Apenas pedidos entregues/concluídos
    }).populate('itens.item');
    
    // Calcular métricas
    const vendasTotais = pedidos.reduce((total, pedido) => total + pedido.valorTotal, 0);
    const pedidosTotais = pedidos.length;
    const ticketMedio = pedidosTotais > 0 ? vendasTotais / pedidosTotais : 0;
    
    // Agrupar itens vendidos
    const itensQuantidade = {};
    pedidos.forEach(pedido => {
      pedido.itens.forEach(itemPedido => {
        const itemId = itemPedido.item._id.toString();
        if (itensQuantidade[itemId]) {
          itensQuantidade[itemId].quantidade += itemPedido.quantidade;
        } else {
          itensQuantidade[itemId] = {
            itemId: itemPedido.item._id,
            nomeItem: itemPedido.item.nome,
            quantidade: itemPedido.quantidade
          };
        }
      });
    });
    
    // Ordenar itens por quantidade vendida (Top 10)
    const itensMaisVendidos = Object.values(itensQuantidade)
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 10);
    
    // Calcular receita por categoria
    const receitaPorCategoria = {};
    pedidos.forEach(pedido => {
      pedido.itens.forEach(itemPedido => {
        const categoria = itemPedido.item.categoria;
        const valorItem = itemPedido.item.preco * itemPedido.quantidade;
        if (receitaPorCategoria[categoria]) {
          receitaPorCategoria[categoria] += valorItem;
        } else {
          receitaPorCategoria[categoria] = valorItem;
        }
      });
    });
    
    // Agrupar pedidos por hora do dia para identificar horários de pico
    const horariosPico = {};
    pedidos.forEach(pedido => {
      const hora = pedido.dataPedido.getHours();
      if (horariosPico[hora]) {
        horariosPico[hora]++;
      } else {
        horariosPico[hora] = 1;
      }
    });
    
    const horariosPicoArray = Object.entries(horariosPico)
      .map(([hora, pedidos]) => ({ hora: parseInt(hora), pedidos }))
      .sort((a, b) => b.pedidos - a.pedidos);
    
    // Salvar estatísticas no banco
    const estatisticas = new Estatisticas({
      periodo,
      dataReferencia,
      vendasTotais,
      pedidosTotais,
      ticketMedio,
      itensMaisVendidos,
      receitaPorCategoria: Object.entries(receitaPorCategoria).map(([categoria, receita]) => ({
        categoria,
        receita
      })),
      horariosPico: horariosPicoArray
    });
    
    await estatisticas.save();
    
    console.log(`Estatísticas ${periodo} para ${dataReferencia.toISOString()} geradas com sucesso.`);
    return estatisticas;
  } catch (error) {
    console.error('Erro ao gerar estatísticas:', error);
    throw error;
  }
};

// Exportar função para uso em outras partes do sistema
module.exports = { gerarEstatisticas };

// Se o script for chamado diretamente, executar uma vez
if (require.main === module) {
  const periodo = process.argv[2] || 'diario'; // Padrão: diário
  gerarEstatisticas(periodo).catch(console.error);
}