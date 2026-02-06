// Global variables
let currentTableNumber = null;
let currentRestauranteId = null;
let currentClientName = '';
let cart = [];
let socket = null;
let currentLanguage = 'pt';

// Translations
const translations = {
  pt: {
    welcome: 'Bem-vindo ao Sistema de Restaurante',
    yourName: 'Seu nome',
    startOrder: 'Iniciar Pedido',
    digitalMenu: 'Cardápio Digital',
    all: 'Todos',
    snacks: 'Lanches',
    pizzas: 'Pizzas',
    drinks: 'Bebidas',
    cart: 'Carrinho',
    total: 'Total',
    finishOrder: 'Finalizar Pedido',
    orderConfirmed: 'Pedido Confirmado!',
    orderSent: 'Seu pedido foi enviado à cozinha.',
    trackOrder: 'Acompanhe o status do seu pedido na tela.',
    makeAnotherOrder: 'Fazer Outro Pedido',
    points: 'Pontos',
    level: 'Nível',
    bronze: 'Bronze',
    silver: 'Prata',
    gold: 'Ouro',
    platinum: 'Platina',
    selectRestaurant: 'Selecione um Restaurante',
    chooseRestaurant: 'Escolha um restaurante...'
  },
  en: {
    welcome: 'Welcome to Restaurant System',
    yourName: 'Your name',
    startOrder: 'Start Order',
    digitalMenu: 'Digital Menu',
    all: 'All',
    snacks: 'Snacks',
    pizzas: 'Pizzas',
    drinks: 'Drinks',
    cart: 'Cart',
    total: 'Total',
    finishOrder: 'Finish Order',
    orderConfirmed: 'Order Confirmed!',
    orderSent: 'Your order has been sent to the kitchen.',
    trackOrder: 'Track your order status on screen.',
    makeAnotherOrder: 'Make Another Order',
    points: 'Points',
    level: 'Level',
    bronze: 'Bronze',
    silver: 'Silver',
    gold: 'Gold',
    platinum: 'Platinum',
    selectRestaurant: 'Select a Restaurant',
    chooseRestaurant: 'Choose a restaurant...'
  },
  es: {
    welcome: 'Bienvenido al Sistema de Restaurante',
    yourName: 'Tu nombre',
    startOrder: 'Iniciar Pedido',
    digitalMenu: 'Menú Digital',
    all: 'Todos',
    snacks: 'Aperitivos',
    pizzas: 'Pizzas',
    drinks: 'Bebidas',
    cart: 'Carrito',
    total: 'Total',
    finishOrder: 'Finalizar Pedido',
    orderConfirmed: '¡Pedido Confirmado!',
    orderSent: 'Su pedido ha sido enviado a la cocina.',
    trackOrder: 'Siga el estado de su pedido en pantalla.',
    makeAnotherOrder: 'Hacer Otro Pedido',
    points: 'Puntos',
    level: 'Nivel',
    bronze: 'Bronce',
    silver: 'Plata',
    gold: 'Oro',
    platinum: 'Platino',
    selectRestaurant: 'Seleccione un Restaurante',
    chooseRestaurant: 'Elija un restaurante...'
  }
};

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
  initializeApp();
});

function initializeApp() {
  // Connect to socket
  socket = io();
  
  // Load restaurants
  loadRestaurants();
  
  // Set up event listeners
  setupEventListeners();
  
  // Update language display
  updateLanguageDisplay();
}

function loadRestaurants() {
  fetch('/api/admin/restaurantes')
    .then(response => response.json())
    .then(restaurantes => {
      const select = document.getElementById('restaurante-select');
      select.innerHTML = `<option value="">${translations[currentLanguage].chooseRestaurant}</option>`;
      
      restaurantes.forEach(restaurante => {
        const option = document.createElement('option');
        option.value = restaurante._id;
        option.textContent = restaurante.nome;
        select.appendChild(option);
      });
    })
    .catch(error => {
      console.error('Error loading restaurants:', error);
      showNotification('Erro ao carregar restaurantes', 'error');
    });
}

function carregarMesa() {
  const select = document.getElementById('restaurante-select');
  const restauranteId = select.value;
  
  if (!restauranteId) {
    // Hide login section and show restaurant selection
    document.getElementById('restaurante-section').classList.add('active');
    document.getElementById('login-section').classList.remove('active');
    document.getElementById('menu-section').classList.remove('active');
    return;
  }
  
  // Store restaurante ID
  currentRestauranteId = restauranteId;
  
  // Show login section
  document.getElementById('restaurante-section').classList.remove('active');
  document.getElementById('login-section').classList.add('active');
  
  // Update hidden input
  document.getElementById('restaurante-id').value = restauranteId;
  
  // Load menu items for this restaurant
  loadMenuItems(restauranteId);
}

function setupEventListeners() {
  // Listen for order updates
  socket.on('pedido-atualizado', function(pedido) {
    showNotification('Status do pedido atualizado: ' + pedido.status, 'info');
  });
  
  // Listen for new order sounds
  socket.on('novo-pedido-sound', function(hasSound) {
    if (hasSound) {
      playNotificationSound();
    }
  });
}

function playNotificationSound() {
  // Create a simple beep sound using Web Audio API
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.type = 'sine';
    oscillator.frequency.value = 800;
    gainNode.gain.value = 0.3;

    oscillator.start();
    setTimeout(() => {
      oscillator.stop();
    }, 500);
  } catch (e) {
      console.error("Could not play sound:", e);
  }
}

function iniciarPedido() {
  const nomeInput = document.getElementById('cliente-nome');
  const nome = nomeInput.value.trim();
  
  if (!nome) {
    showNotification('Por favor, informe seu nome', 'error');
    return;
  }
  
  currentClientName = nome;
  document.getElementById('nome-cliente').textContent = nome;
  
  // Show menu section
  document.getElementById('login-section').classList.remove('active');
  document.getElementById('menu-section').classList.add('active');
  
  // Update loyalty display
  updateLoyaltyDisplay();
}

function loadMenuItems(restauranteId) {
  fetch(`/api/cardapio/${restauranteId}`)
    .then(response => response.json())
    .then(items => {
      displayMenuItems(items);
    })
    .catch(error => {
      console.error('Error loading menu items:', error);
      showNotification('Erro ao carregar o cardápio', 'error');
    });
}

function displayMenuItems(items) {
  const container = document.getElementById('cardapio-itens');
  container.innerHTML = '';
  
  items.forEach(item => {
    const itemElement = createMenuItemElement(item);
    container.appendChild(itemElement);
  });
}

function createMenuItemElement(item) {
  const div = document.createElement('div');
  div.className = 'item-card';
  div.innerHTML = `
    <img src="${item.imagem || '/images/default-food.jpg'}" alt="${item.nome}">
    <div class="item-info">
      <h3>${item.nome}</h3>
      <p>${item.descricao}</p>
      <div class="item-price">R$ ${item.preco.toFixed(2)}</div>
    </div>
    <div class="item-actions">
      <div class="quantity-controls">
        <button class="quantity-btn minus" onclick="adjustQuantity(this, -1)">-</button>
        <input type="number" class="quantity-input" value="1" min="1">
        <button class="quantity-btn plus" onclick="adjustQuantity(this, 1)">+</button>
      </div>
      <button class="add-to-cart-btn" onclick="addToCart(${JSON.stringify(item).replace(/"/g, '&quot;')})">
        Adicionar
      </button>
    </div>
  `;
  return div;
}

function adjustQuantity(button, change) {
  const input = button.parentElement.querySelector('.quantity-input');
  let value = parseInt(input.value) || 1;
  value += change;
  if (value < 1) value = 1;
  input.value = value;
}

function addToCart(item) {
  // Parse the item from the string passed from HTML
  const parsedItem = typeof item === 'string' ? JSON.parse(item.replace(/&quot;/g, '"')) : item;
  
  // Check if item already exists in cart
  const existingItemIndex = cart.findIndex(cartItem => cartItem.id === parsedItem.id);
  
  if (existingItemIndex > -1) {
    // Update quantity if item exists
    cart[existingItemIndex].quantidade += parseInt(document.activeElement.closest('.item-card').querySelector('.quantity-input').value);
  } else {
    // Add new item to cart
    const quantityInput = document.activeElement.closest('.item-card').querySelector('.quantity-input');
    cart.push({
      ...parsedItem,
      quantidade: parseInt(quantityInput.value)
    });
  }
  
  updateCartDisplay();
  showNotification(`${parsedItem.nome} adicionado ao carrinho!`, 'success');
}

function removeFromCart(index) {
  cart.splice(index, 1);
  updateCartDisplay();
}

function updateCartDisplay() {
  const cartItemsContainer = document.getElementById('carrinho-itens');
  const cartCountElement = document.getElementById('carrinho-count');
  const cartTotalElement = document.getElementById('carrinho-total');
  const finishOrderBtn = document.getElementById('finalizar-pedido-btn');
  
  // Update cart count
  const totalCount = cart.reduce((sum, item) => sum + item.quantidade, 0);
  cartCountElement.textContent = totalCount;
  
  // Calculate total
  const total = cart.reduce((sum, item) => sum + (item.preco * item.quantidade), 0);
  cartTotalElement.textContent = total.toFixed(2);
  
  // Enable/disable finish order button
  finishOrderBtn.disabled = cart.length === 0;
  
  // Display cart items
  cartItemsContainer.innerHTML = '';
  cart.forEach((item, index) => {
    const cartItemElement = document.createElement('div');
    cartItemElement.className = 'carrinho-item';
    cartItemElement.innerHTML = `
      <div class="carrinho-item-info">
        <div>${item.nome} x${item.quantidade}</div>
        <div>R$ ${(item.preco * item.quantidade).toFixed(2)}</div>
      </div>
      <div class="carrinho-item-actions">
        <button class="remove-item-btn" onclick="removeFromCart(${index})">Remover</button>
      </div>
    `;
    cartItemsContainer.appendChild(cartItemElement);
  });
}

function filtrarCategoria(categoria) {
  // Remove active class from all buttons
  document.querySelectorAll('.filtro-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Add active class to clicked button
  event.target.classList.add('active');
  
  // Reload menu with filter
  if (currentRestauranteId) {
    fetch(`/api/cardapio/${currentRestauranteId}`)
      .then(response => response.json())
      .then(items => {
        if (categoria) {
          items = items.filter(item => item.categoria === categoria);
        }
        displayMenuItems(items);
      });
  }
}

function finalizarPedido() {
  if (cart.length === 0) {
    showNotification('Carrinho vazio!', 'error');
    return;
  }
  
  // Extract table number from URL (if available) or use default
  const urlParams = new URLSearchParams(window.location.search);
  const tableNumber = urlParams.get('table') || '1'; // Default to table 1 if not specified
  
  const pedido = {
    mesaNumero: tableNumber,
    restauranteId: currentRestauranteId,
    itens: cart,
    clienteNome: currentClientName
  };
  
  fetch('/api/pedidos', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(pedido)
  })
  .then(response => response.json())
  .then(data => {
    // Show confirmation
    document.getElementById('menu-section').classList.remove('active');
    document.getElementById('confirmacao-section').classList.add('active');
    document.getElementById('numero-pedido').textContent = data._id.slice(-6); // Last 6 chars of ID
    
    // Clear cart
    cart = [];
    updateCartDisplay();
    
    showNotification('Pedido realizado com sucesso!', 'success');
  })
  .catch(error => {
    console.error('Error placing order:', error);
    showNotification('Erro ao finalizar pedido', 'error');
  });
}

function voltarAoInicio() {
  document.getElementById('menu-section').classList.remove('active');
  document.getElementById('login-section').classList.remove('active');
  document.getElementById('restaurante-section').classList.add('active');
  
  // Clear cart
  cart = [];
  updateCartDisplay();
}

function voltarAoMenu() {
  document.getElementById('confirmacao-section').classList.remove('active');
  document.getElementById('menu-section').classList.add('active');
}

// Loyalty program functions
function updateLoyaltyDisplay() {
  // In a real app, we would fetch actual loyalty data
  // For demo, we'll use mock data
  const points = 1500;
  const level = 'silver';
  
  document.getElementById('points-display').textContent = `${translations[currentLanguage].points}: ${points}`;
  document.getElementById('level-display').textContent = `${translations[currentLanguage].level}: ${getLevelName(level)}`;
}

function getLevelName(level) {
  switch(level) {
    case 'bronze': return translations[currentLanguage].bronze;
    case 'silver': return translations[currentLanguage].silver;
    case 'gold': return translations[currentLanguage].gold;
    case 'platinum': return translations[currentLanguage].platinum;
    default: return translations[currentLanguage].bronze;
  }
}

// Language functions
function changeLanguage() {
  const select = document.getElementById('lang-select');
  currentLanguage = select.value;
  updateLanguageDisplay();
}

function updateLanguageDisplay() {
  const t = translations[currentLanguage];
  
  // Update static text that can be easily identified
  const titleElement = document.querySelector('title');
  if (titleElement) {
    titleElement.textContent = `${t.digitalMenu} - Sistema de Restaurante`;
  }
  
  // Update other texts as needed
  // This would typically involve adding data attributes to HTML elements to identify translatable text
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

// Service Worker for push notifications (if supported)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('SW registered: ', registration);
      })
      .catch(registrationError => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}