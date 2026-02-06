// Counter App JavaScript
let counterSocket = null;
let counterToken = localStorage.getItem('counterToken');
let currentUser = JSON.parse(localStorage.getItem('counterUser')) || null;

// Initialize the counter app
document.addEventListener('DOMContentLoaded', function() {
  initializeCounterApp();
});

function initializeCounterApp() {
  // Connect to socket
  counterSocket = io();
  
  // Check if user is already logged in
  if (counterToken && currentUser) {
    showDashboard();
  } else {
    showLogin();
  }
  
  // Listen for order updates
  counterSocket.on('novo-pedido', function(pedido) {
    loadOrders();
    showNotification('Novo pedido recebido!', 'info');
  });
  
  counterSocket.on('pedido-atualizado', function(pedido) {
    loadOrders();
    showNotification(`Status do pedido #${pedido._id.slice(-6)} atualizado para: ${pedido.status}`, 'info');
  });
}

function showLogin() {
  document.getElementById('login-section').classList.add('active');
  document.getElementById('counter-dashboard').classList.remove('active');
}

function showDashboard() {
  document.getElementById('login-section').classList.remove('active');
  document.getElementById('counter-dashboard').classList.add('active');
  
  if (currentUser) {
    document.getElementById('counter-user-name').textContent = currentUser.name;
  }
  
  loadOrders();
  loadStats();
}

function loginCounter() {
  const email = document.getElementById('counter-email').value;
  const password = document.getElementById('counter-password').value;
  
  fetch('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: email,
      password: password,
      role: 'counter'
    })
  })
  .then(response => response.json())
  .then(data => {
    if (data.token) {
      counterToken = data.token;
      currentUser = data.user;
      
      localStorage.setItem('counterToken', counterToken);
      localStorage.setItem('counterUser', JSON.stringify(currentUser));
      
      showDashboard();
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
  counterToken = null;
  currentUser = null;
  
  localStorage.removeItem('counterToken');
  localStorage.removeItem('counterUser');
  
  document.getElementById('counter-email').value = '';
  document.getElementById('counter-password').value = '';
  
  showLogin();
  showNotification('Logout realizado com sucesso', 'info');
}

function loadOrders() {
  fetch('/api/pedidos', {
    headers: {
      'Authorization': `Bearer ${counterToken}`
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
  const receivedOrders = pedidos.filter(pedido => pedido.status === 'received');
  const confirmedOrders = pedidos.filter(pedido => pedido.status === 'confirmed');
  
  displayOrderList('pedidos-recebidos', receivedOrders, 'received');
  displayOrderList('pedidos-confirmados', confirmedOrders, 'confirmed');
  
  // Update stats
  document.getElementById('pedidos-pendentes').textContent = receivedOrders.length;
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
      <div class="pedido-status status-${pedido.status}">${pedido.status}</div>
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
      ${status === 'received' ? `
        <button class="status-btn btn-confirmar" onclick="updateOrderStatus('${pedido._id}', 'confirmed')">
          Confirmar
        </button>
      ` : ''}
      ${status === 'confirmed' ? `
        <button class="status-btn btn-preparando" onclick="updateOrderStatus('${pedido._id}', 'preparing')">
          Em Preparo
        </button>
      ` : ''}
    </div>
  `;
  return div;
}

function updateOrderStatus(orderId, newStatus) {
  fetch(`/api/pedidos/${orderId}/status`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${counterToken}`
    },
    body: JSON.stringify({ status: newStatus })
  })
  .then(response => response.json())
  .then(data => {
    loadOrders();
    showNotification(`Pedido atualizado para: ${newStatus}`, 'success');
  })
  .catch(error => {
    console.error('Error updating order status:', error);
    showNotification('Erro ao atualizar pedido', 'error');
  });
}

function loadStats() {
  // For demo purposes, using mock data
  // In a real app, we would fetch from the analytics endpoint
  document.getElementById('total-pedidos-hoje').textContent = '24';
  document.getElementById('faturamento-hoje').textContent = 'R$ 1.240,00';
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