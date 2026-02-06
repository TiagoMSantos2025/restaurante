// Kitchen App JavaScript
let kitchenSocket = null;
let kitchenToken = localStorage.getItem('kitchenToken');
let currentKitchenUser = JSON.parse(localStorage.getItem('kitchenUser')) || null;

// Initialize the kitchen app
document.addEventListener('DOMContentLoaded', function() {
  initializeKitchenApp();
});

function initializeKitchenApp() {
  // Connect to socket
  kitchenSocket = io();
  
  // Check if user is already logged in
  if (kitchenToken && currentKitchenUser) {
    showKitchenDashboard();
  } else {
    showLogin();
  }
  
  // Listen for order updates
  kitchenSocket.on('novo-pedido', function(pedido) {
    loadOrders();
    showNotification('Novo pedido recebido!', 'info');
  });
  
  kitchenSocket.on('pedido-atualizado', function(pedido) {
    loadOrders();
    showNotification(`Status do pedido #${pedido._id.slice(-6)} atualizado para: ${pedido.status}`, 'info');
  });
}

function showLogin() {
  document.getElementById('login-section').classList.add('active');
  document.getElementById('kitchen-dashboard').classList.remove('active');
}

function showKitchenDashboard() {
  document.getElementById('login-section').classList.remove('active');
  document.getElementById('kitchen-dashboard').classList.add('active');
  
  if (currentKitchenUser) {
    document.getElementById('kitchen-user-name').textContent = currentKitchenUser.name;
  }
  
  loadOrders();
  loadStats();
}

function loginKitchen() {
  const email = document.getElementById('kitchen-email').value;
  const password = document.getElementById('kitchen-password').value;
  
  fetch('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: email,
      password: password,
      role: 'kitchen'
    })
  })
  .then(response => response.json())
  .then(data => {
    if (data.token) {
      kitchenToken = data.token;
      currentKitchenUser = data.user;
      
      localStorage.setItem('kitchenToken', kitchenToken);
      localStorage.setItem('kitchenUser', JSON.stringify(currentKitchenUser));
      
      showKitchenDashboard();
      showNotification('Login realizado com sucesso!', 'success');
    } else {
      showNotification(data.error || 'Erro no login', 'error');
    }
  })
  .catch(error => {
    console.error('Error logging in:', error);
    showNotification('Erro ao fazer login', 'error');
  });
}

function logout() {
  kitchenToken = null;
  currentKitchenUser = null;
  
  localStorage.removeItem('kitchenToken');
  localStorage.removeItem('kitchenUser');
  
  document.getElementById('kitchen-email').value = '';
  document.getElementById('kitchen-password').value = '';
  
  showLogin();
  showNotification('Logout realizado com sucesso', 'info');
}

function loadOrders() {
  fetch('/api/pedidos', {
    headers: {
      'Authorization': `Bearer ${kitchenToken}`
    }
  })
  .then(response => response.json())
  .then(pedidos => {
    displayOrders(pedidos);
  })
  .catch(error => {
    console.error('Error loading orders:', error);
    showNotification('Erro ao carregar pedidos', 'error');
  });
}

function displayOrders(pedidos) {
  // Separate orders by status
  const confirmedOrders = pedidos.filter(pedido => pedido.status === 'confirmed');
  const preparingOrders = pedidos.filter(pedido => pedido.status === 'preparing');
  const readyOrders = pedidos.filter(pedido => pedido.status === 'ready');
  
  displayOrderList('pedidos-confirmados', confirmedOrders, 'confirmed');
  displayOrderList('pedidos-em-preparo-lista', preparingOrders, 'preparing');
  displayOrderList('pedidos-prontos-lista', readyOrders, 'ready');
  
  // Update stats
  document.getElementById('pedidos-em-preparo').textContent = preparingOrders.length;
  document.getElementById('pedidos-prontos').textContent = readyOrders.length;
}

function displayOrderList(containerId, orders, status) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  
  if (orders.length === 0) {
    container.innerHTML = '<p>Nenhum pedido encontrado</p>';
    return;
  }
  
  orders.forEach(pedido => {
    const orderElement = createOrderElement(pedido, status);
    container.appendChild(orderElement);
  });
}

function createOrderElement(pedido, status) {
  const div = document.createElement('div');
  div.className = `pedido-item ${pedido.status}`;
  div.innerHTML = `
    <div class="pedido-header">
      <div class="pedido-mesa">Mesa ${pedido.mesa.numero}</div>
      <div class="pedido-status status-${pedido.status}">${getStatusText(pedido.status)}</div>
    </div>
    <div class="pedido-cliente">Cliente: ${pedido.clienteNome}</div>
    <div class="pedido-itens">
      ${pedido.itens.map(item => `
        <div class="pedido-item-detalhes">
          <span>${item.nome} x${item.quantidade}</span>
          <span>R$ ${(item.preco * item.quantidade).toFixed(2)}</span>
        </div>
      `).join('')}
    </div>
    <div class="pedido-total">Total: R$ ${pedido.total.toFixed(2)}</div>
    <div class="status-buttons">
      ${status === 'confirmed' ? `
        <button class="status-btn btn-preparando" onclick="updateOrderStatus('${pedido._id}', 'preparing')">
          Iniciar Preparo
        </button>
      ` : ''}
      ${status === 'preparing' ? `
        <button class="status-btn btn-pronto" onclick="updateOrderStatus('${pedido._id}', 'ready')">
          Pronto
        </button>
      ` : ''}
      ${status === 'ready' ? `
        <button class="status-btn btn-entregar" onclick="updateOrderStatus('${pedido._id}', 'delivered')">
          Entregue
        </button>
      ` : ''}
    </div>
  `;
  return div;
}

function getStatusText(status) {
  switch(status) {
    case 'received': return 'Recebido';
    case 'confirmed': return 'Confirmado';
    case 'preparing': return 'Em Preparo';
    case 'ready': return 'Pronto';
    case 'delivered': return 'Entregue';
    default: return status;
  }
}

function updateOrderStatus(orderId, newStatus) {
  fetch(`/api/pedidos/${orderId}/status`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${kitchenToken}`
    },
    body: JSON.stringify({ status: newStatus })
  })
  .then(response => response.json())
  .then(data => {
    loadOrders();
    showNotification(`Pedido atualizado para: ${getStatusText(newStatus)}`, 'success');
  })
  .catch(error => {
    console.error('Error updating order status:', error);
    showNotification('Erro ao atualizar pedido', 'error');
  });
}

function loadStats() {
  // For demo purposes, using mock data
  // In a real app, we would fetch from the analytics endpoint
  document.getElementById('pedidos-em-preparo').textContent = '3';
  document.getElementById('pedidos-prontos').textContent = '2';
  document.getElementById('tempo-medio').textContent = '12 min';
}

// Notification system
function showNotification(message, type = 'info') {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification-banner notification-${type}`;
  notification.textContent = message;
  
  // Add to document
  document.body.appendChild(notification);
  
  // Remove after delay
  setTimeout(() => {
    notification.remove();
  }, 3000);
}

// Language functions (shared with main script)
function changeLanguage() {
  const select = document.getElementById('lang-select');
  const lang = select.value;
  
  // In a real app, we would update all UI text based on the selected language
  // For now, just store the preference
  localStorage.setItem('preferredLanguage', lang);
}