// Variáveis globais
let mesaAtual = null;
let itensCardapio = [];
let pedidoAtual = [];
let token = localStorage.getItem('token') || null;

// Inicializar Socket.IO
const socket = io();

// Função para verificar autenticação
function verificarAutenticacao() {
  return token !== null;
}

// Função para fazer login
async function fazerLogin(email, senha) {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, senha })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      token = data.token;
      localStorage.setItem('token', token);
      return { sucesso: true, usuario: data.usuario };
    } else {
      return { sucesso: false, mensagem: data.error };
    }
  } catch (error) {
    console.error('Erro ao fazer login:', error);
    return { sucesso: false, mensagem: 'Erro de conexão com o servidor' };
  }
}

// Função para fazer logout
function fazerLogout() {
  token = null;
  localStorage.removeItem('token');
}

// Função para entrar na mesa
async function entrarNaMesa() {
  const numeroMesa = document.getElementById('numero-mesa').value.trim();
  
  if (!numeroMesa) {
    alert('Por favor, digite o número da mesa.');
    return;
  }

  try {
    // Aqui faríamos uma requisição para obter informações da mesa pelo código QR
    // Por enquanto, vamos simular
    mesaAtual = {
      _id: `mesa-${numeroMesa}`,
      numero: numeroMesa,
      codigoQR: `qr-${numeroMesa}`
    };

    // Mostrar tela do cardápio
    document.getElementById('tela-entrada').classList.add('oculto');
    document.getElementById('tela-cardapio').classList.remove('oculto');
    
    // Exibir número da mesa
    document.getElementById('numero-mesa-display').textContent = numeroMesa;
    
    // Carregar cardápio
    await carregarCardapio();
    
    // Conectar ao socket para esta mesa
    socket.emit('cliente_connect', numeroMesa);
  } catch (error) {
    console.error('Erro ao entrar na mesa:', error);
    alert('Erro ao conectar à mesa. Verifique o número e tente novamente.');
  }
}

// Função para carregar o cardápio
async function carregarCardapio() {
  try {
    const response = await fetch('/api/cardapio');
    itensCardapio = await response.json();
    renderizarCardapio(itensCardapio);
  } catch (error) {
    console.error('Erro ao carregar cardáio:', error);
  }
}

// Função para renderizar o cardápio com avaliações
async function renderizarCardapio(itens, categoria = 'todos') {
  const container = document.getElementById('itens-cardapio');
  
  let itensFiltrados = itens;
  if (categoria !== 'todos') {
    itensFiltrados = itens.filter(item => item.categoria === categoria);
  }
  
  container.innerHTML = '';
  
  for (const item of itensFiltrados) {
    const itemElement = document.createElement('div');
    itemElement.className = 'item-cardapio';
    
    // Verificar se o item está nos favoritos
    let isFavorito = false;
    if (verificarAutenticacao()) {
      const favoritos = await verificarFavoritos();
      isFavorito = favoritos.some(fav => fav._id === item._id);
    }
    
    // Criar estrelas para a média de avaliações
    let estrelas = '';
    if (item.mediaAvaliacoes) {
      const media = Math.round(item.mediaAvaliacoes);
      for (let i = 1; i <= 5; i++) {
        estrelas += i <= media ? '★' : '☆';
      }
      estrelas = `<div class="avaliacao-media">${estrelas} (${item.mediaAvaliacoes.toFixed(1)})</div>`;
    } else {
      estrelas = '<div class="avaliacao-media">Ainda não avaliado</div>';
    }
    
    itemElement.innerHTML = `
      <div class="item-imagem">
        ${item.imagem ? `<img src="${item.imagem}" alt="${item.nome}">` : `<span>${item.nome}</span>`}
      </div>
      <div class="item-info">
        <div class="item-titulo">${item.nome}</div>
        <div class="item-descricao">${item.descricao}</div>
        <div class="item-preco">R$ ${item.preco.toFixed(2)}</div>
        ${estrelas}
        <div class="item-acoes">
          <button class="favorito-btn" data-id="${item._id}" onclick="alternarFavorito('${item._id}')" style="color: ${isFavorito ? 'red' : 'black'}">♡</button>
        </div>
        <div class="item-quantidade">
          <button onclick="alterarQuantidade('${item._id}', -1)">-</button>
          <input type="number" id="quantidade-${item._id}" value="1" min="1" readonly>
          <button onclick="alterarQuantidade('${item._id}', 1)">+</button>
        </div>
        <button class="item-adicionar" onclick="adicionarAoPedido('${item._id}')">Adicionar</button>
      </div>
    `;
    container.appendChild(itemElement);
  }
}

// Função para mostrar categoria específica
function mostrarCategoria(categoria) {
  // Atualizar botões de categoria
  document.querySelectorAll('.categoria-btn').forEach(btn => {
    btn.classList.remove('ativo');
  });
  event.target.classList.add('ativo');
  
  // Renderizar cardápio pela categoria
  renderizarCardapio(itensCardapio, categoria);
}

// Função para alterar quantidade de um item
function alterarQuantidade(itemId, incremento) {
  const input = document.getElementById(`quantidade-${itemId}`);
  let quantidade = parseInt(input.value);
  quantidade += incremento;
  
  if (quantidade < 1) quantidade = 1;
  
  input.value = quantidade;
}

// Função para adicionar item ao pedido
function adicionarAoPedido(itemId) {
  const item = itensCardapio.find(i => i._id === itemId);
  if (!item) return;
  
  const quantidadeInput = document.getElementById(`quantidade-${itemId}`);
  const quantidade = parseInt(quantidadeInput.value);
  
  // Verificar se o item já está no pedido
  const itemExistente = pedidoAtual.find(i => i.item._id === itemId);
  
  if (itemExistente) {
    itemExistente.quantidade += quantidade;
  } else {
    pedidoAtual.push({
      item: { ...item },
      quantidade: quantidade
    });
  }
  
  // Resetar quantidade para 1
  quantidadeInput.value = 1;
  
  // Atualizar carrinho
  atualizarCarrinho();
}

// Função para atualizar o carrinho
function atualizarCarrinho() {
  const container = document.getElementById('itens-pedido');
  let total = 0;
  
  container.innerHTML = '';
  
  if (pedidoAtual.length === 0) {
    container.innerHTML = '<p>Carrinho vazio</p>';
    document.getElementById('valor-total').textContent = '0,00';
    return;
  }
  
  pedidoAtual.forEach((itemPedido, index) => {
    const valorItem = itemPedido.item.preco * itemPedido.quantidade;
    total += valorItem;
    
    const itemElement = document.createElement('div');
    itemElement.className = 'item-pedido';
    itemElement.innerHTML = `
      <div class="item-pedido-info">
        <div>${itemPedido.item.nome}</div>
        <div>Qtd: ${itemPedido.quantidade} x R$ ${itemPedido.item.preco.toFixed(2)}</div>
      </div>
      <div class="item-pedido-acao">
        <div>R$ ${valorItem.toFixed(2)}</div>
        <button class="btn-remover" onclick="removerDoPedido(${index})">Remover</button>
      </div>
    `;
    container.appendChild(itemElement);
  });
  
  document.getElementById('valor-total').textContent = total.toFixed(2).replace('.', ',');
}

// Função para remover item do pedido
function removerDoPedido(index) {
  pedidoAtual.splice(index, 1);
  atualizarCarrinho();
}

// Função para finalizar pedido
async function finalizarPedido() {
  if (pedidoAtual.length === 0) {
    alert('Seu pedido está vazio!');
    return;
  }
  
  const nomeCliente = document.getElementById('nome-cliente').value.trim();
  if (!nomeCliente) {
    alert('Por favor, informe seu nome.');
    return;
  }
  
  try {
    const pedido = {
      mesa: mesaAtual._id,
      cliente: nomeCliente,
      itens: pedidoAtual.map(item => ({
        item: item.item._id,
        quantidade: item.quantidade
      }))
    };
    
    const response = await fetch('/api/pedidos', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(pedido)
    });
    
    if (response.ok) {
      const pedidoSalvo = await response.json();
      
      // Calcular valor total do pedido para atribuir pontos
      const valorTotal = pedidoSalvo.valorTotal;
      
      // Adicionar pontos de fidelidade (opcional, dependendo da configuração)
      if (verificarAutenticacao()) {
        try {
          // Atribuir pontos automaticamente após o pedido
          // Esta funcionalidade seria tratada no backend após a confirmação do pagamento
        } catch (error) {
          console.error('Erro ao atribuir pontos:', error);
        }
      }
      
      // Mostrar tela de confirmação
      document.getElementById('tela-cardapio').classList.add('oculto');
      document.getElementById('tela-confirmacao').classList.remove('oculto');
      document.getElementById('numero-pedido').textContent = pedidoSalvo._id;
      
      // Limpar pedido atual
      pedidoAtual = [];
      atualizarCarrinho();
    } else {
      throw new Error('Erro ao enviar pedido');
    }
  } catch (error) {
    console.error('Erro ao finalizar pedido:', error);
    alert('Erro ao enviar o pedido. Tente novamente.');
  }
}

// Função para voltar ao cardápio
function voltarAoCardapio() {
  document.getElementById('tela-confirmacao').classList.add('oculto');
  document.getElementById('tela-cardapio').classList.remove('oculto');
}

// Event listeners para tecla Enter no campo da mesa
document.getElementById('numero-mesa').addEventListener('keypress', function(e) {
  if (e.key === 'Enter') {
    entrarNaMesa();
  }
});

// Listener para atualizações de pedido via socket
socket.on('pedido_atualizado', (pedido) => {
  if (pedido.mesa._id === mesaAtual._id) {
    // Atualizar status do pedido do cliente
    console.log('Pedido atualizado:', pedido);
  }
});

// Função para verificar se um item está nos favoritos
async function verificarFavoritos() {
  if (!verificarAutenticacao()) return [];
  
  try {
    const response = await fetch('/api/favoritos', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.ok) {
      return await response.json();
    }
    return [];
  } catch (error) {
    console.error('Erro ao verificar favoritos:', error);
    return [];
  }
}

// Função para adicionar/remover item dos favoritos
async function alternarFavorito(itemId) {
  if (!verificarAutenticacao()) {
    alert('Faça login para adicionar itens aos favoritos');
    return;
  }
  
  try {
    const favoritos = await verificarFavoritos();
    const isFavorito = favoritos.some(item => item._id === itemId);
    
    const method = isFavorito ? 'DELETE' : 'POST';
    const response = await fetch(`/api/favoritos/${itemId}`, {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.ok) {
      // Atualizar visualmente o ícone de favorito
      const heartIcon = document.querySelector(`.favorito-btn[data-id="${itemId}"]`);
      if (heartIcon) {
        heartIcon.textContent = isFavorito ? '♡' : '♥';
        heartIcon.style.color = isFavorito ? 'black' : 'red';
      }
    }
  } catch (error) {
    console.error('Erro ao alternar favorito:', error);
  }
}

// Função para adicionar avaliação a um item
async function adicionarAvaliacao(itemId, nota, comentario = '') {
  if (!verificarAutenticacao()) {
    alert('Faça login para avaliar itens');
    return;
  }
  
  try {
    const response = await fetch(`/api/cardapio/${itemId}/avaliacao`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ nota, comentario })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      alert('Avaliação adicionada com sucesso!');
      // Recarregar o cardápio para mostrar a nova média
      await carregarCardapio();
    } else {
      alert(data.error || 'Erro ao adicionar avaliação');
    }
  } catch (error) {
    console.error('Erro ao adicionar avaliação:', error);
    alert('Erro de conexão com o servidor');
  }
}

// Função para solicitar permissão para notificações push
async function solicitarPermissaoNotificacoes() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('Serviço de notificações push não suportado neste navegador');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array('BCKgrMZXXbD8Jq36N4o3wK4-P1h8v1f4yB9n2K8j5q0r6v4q0r6v4q0r6v4q0r6v4q0r6v4q0r6v4q0r6v4q0r6') // Esta chave deve ser substituída por sua chave VAPID real
    });

    // Enviar subscrição para o servidor
    if (token) { // Somente se o usuário estiver logado
      await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          subscription: subscription,
          tipo: 'cliente'
        })
      });
    }
  } catch (error) {
    console.error('Erro ao solicitar permissão para notificações:', error);
  }
}

// Função auxiliar para converter chave VAPID
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Função para obter perfil de fidelidade do usuário
async function getPerfilFidelidade() {
  if (!verificarAutenticacao()) return null;
  
  try {
    const response = await fetch('/api/fidelidade/perfil', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch (error) {
    console.error('Erro ao obter perfil de fidelidade:', error);
    return null;
  }
}

// Função para exibir informações de fidelidade
async function exibirFidelidade() {
  const perfil = await getPerfilFidelidade();
  if (perfil) {
    // Exibir informações de fidelidade na interface
    const fidelidadeInfo = document.createElement('div');
    fidelidadeInfo.className = 'fidelidade-info';
    fidelidadeInfo.innerHTML = `
      <div class="nivel-fidelidade">${perfil.nivel.toUpperCase()}</div>
      <div class="pontos-acumulados">${perfil.pontosAcumulados} pts</div>
    `;
    
    // Adicionar ao cabeçalho ou em outro lugar apropriado
    const header = document.querySelector('header');
    if (header) {
      header.appendChild(fidelidadeInfo);
    }
  }
}

// Função para obter recompensas disponíveis
async function getRecompensas() {
  try {
    const response = await fetch('/api/fidelidade/recompensas');
    return await response.json();
  } catch (error) {
    console.error('Erro ao obter recompensas:', error);
    return [];
  }
}

// Função para resgatar uma recompensa
async function resgatarRecompensa(recompensaId) {
  if (!verificarAutenticacao()) {
    alert('Faça login para resgatar recompensas');
    return;
  }
  
  try {
    const response = await fetch('/api/fidelidade/resgatar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ recompensaId })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      alert(`Recompensa resgatada com sucesso! Você agora tem ${data.pontosRestantes} pontos.`);
      // Atualizar informações de fidelidade
      exibirFidelidade();
    } else {
      alert(data.error || 'Erro ao resgatar recompensa');
    }
  } catch (error) {
    console.error('Erro ao resgatar recompensa:', error);
    alert('Erro de conexão com o servidor');
  }
}

// Executar exibição de fidelidade quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
  exibirFidelidade();
});

// Solicitar permissão para notificações quando o usuário fizer login
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('Service Worker registrado com sucesso:', registration.scope);
        
        // Solicitar permissão para notificações
        if (Notification.permission === 'granted') {
          solicitarPermissaoNotificacoes();
        } else if (Notification.permission !== 'denied') {
          Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
              solicitarPermissaoNotificacoes();
            }
          });
        }
      })
      .catch(error => {
        console.log('Falha ao registrar service worker:', error);
      });
  });
}
