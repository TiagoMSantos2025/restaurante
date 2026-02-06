const webpush = require('web-push');
const SubscricaoPush = require('../models/SubscricaoPush');

// Configurar web-push com VAPID keys
const vapidKeys = webpush.generateVAPIDKeys();

webpush.setVapidDetails(
  'mailto:contato@restauranteestradeiro.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

class NotificacaoService {
  /**
   * Envia notificação push para usuários específicos
   * @param {string[]} userIds - IDs dos usuários
   * @param {Object} payload - Dados da notificação
   * @param {string} tipo - Tipo de notificação ('balcao', 'cozinha', 'cliente')
   */
  static async enviarNotificacao(userIds, payload, tipo) {
    try {
      // Obter subscrições ativas para os usuários
      const subscricoes = await SubscricaoPush.find({
        usuarioId: { $in: userIds },
        tipo,
        ativo: true
      });

      const promises = subscricoes.map(subscricao =>
        webpush.sendNotification(
          {
            endpoint: subscricao.endpoint,
            keys: {
              auth: subscricao.keys.auth,
              p256dh: subscricao.keys.p256dh
            }
          },
          JSON.stringify(payload)
        )
      );

      await Promise.allSettled(promises);
      console.log(`Notificações enviadas para ${subscricoes.length} dispositivos`);
    } catch (error) {
      console.error('Erro ao enviar notificações push:', error);
      throw error;
    }
  }

  /**
   * Envia notificação para todos os usuários de um tipo específico
   * @param {Object} payload - Dados da notificação
   * @param {string} tipo - Tipo de notificação ('balcao', 'cozinha', 'cliente')
   */
  static async enviarNotificacaoGlobal(payload, tipo) {
    try {
      const subscricoes = await SubscricaoPush.find({
        tipo,
        ativo: true
      });

      const promises = subscricoes.map(subscricao =>
        webpush.sendNotification(
          {
            endpoint: subscricao.endpoint,
            keys: {
              auth: subscricao.keys.auth,
              p256dh: subscricao.keys.p256dh
            }
          },
          JSON.stringify(payload)
        )
      );

      await Promise.allSettled(promises);
      console.log(`Notificação global enviada para ${subscricoes.length} dispositivos`);
    } catch (error) {
      console.error('Erro ao enviar notificação global:', error);
      throw error;
    }
  }

  /**
   * Salva uma nova subscrição push
   * @param {string} usuarioId - ID do usuário
   * @param {Object} subscription - Objeto de subscrição
   * @param {string} tipo - Tipo de notificação
   */
  static async salvarSubscricao(usuarioId, subscription, tipo) {
    try {
      const novaSubscricao = new SubscricaoPush({
        usuarioId,
        endpoint: subscription.endpoint,
        keys: subscription.keys,
        tipo
      });

      await novaSubscricao.save();
      return novaSubscricao;
    } catch (error) {
      console.error('Erro ao salvar subscrição:', error);
      throw error;
    }
  }

  /**
   * Remove uma subscrição push
   * @param {string} subscriptionId - ID da subscrição
   */
  static async removerSubscricao(subscriptionId) {
    try {
      await SubscricaoPush.findByIdAndUpdate(
        subscriptionId,
        { ativo: false },
        { new: true }
      );
    } catch (error) {
      console.error('Erro ao remover subscrição:', error);
      throw error;
    }
  }
}

module.exports = NotificacaoService;