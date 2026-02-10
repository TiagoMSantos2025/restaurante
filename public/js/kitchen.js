// Cozinha Socket.IO
const socket = io();

// Registrar o socket na sala da cozinha
socket.emit('join_room', 'cozinha');

let orders = [];
let bebidaOrders = []; // Para pedidos de bebidas

// Função para tocar som de notificação (agressivo/alto para cozinha)
function playKitchenNotificationSound() {
    const audio = new Audio('/sounds/kitchen-notification.mp3');
    audio.play().catch(e => console.log('Erro ao tocar áudio de cozinha:', e));
}

// Função para tocar som de notificação suave (para balcão)
function playCounterNotificationSound() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(1200, audioContext.currentTime); // Frequência mais alta e suave
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        
        oscillator.start();
        gainNode.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.4);
        oscillator.stop(audioContext.currentTime + 0.4);
    } catch (e) {
        console.log('Não foi possível reproduzir o som de notificação suave');
    }
}

// Função para renderizar os pedidos
function renderOrders() {
    const ordersContainer = document.getElementById('orders-container');
    ordersContainer.innerHTML = '';
    
    // Contadores de status
    let pendingCount = 0;
    let preparingCount = 0;
    
    orders.forEach(order => {
        if (order.status !== 'entregue' && order.status !== 'cancelado') {
            if (order.status === 'pendente') pendingCount++;
            if (order.status === 'em_preparo') preparingCount++;
            
            const orderCard = document.createElement('div');
            orderCard.className = 'order-card';
            
            // Calcular tempo desde o pedido
            const orderTime = new Date(order.hora_pedido);
            const currentTime = new Date();
            const timeDiff = Math.floor((currentTime - orderTime) / 60000); // diferença em minutos
            
            // Formatar itens do pedido - mostrar apenas itens de comida
            const foodItems = order.itens.filter(item => item.tipo === 'comida' || !item.tipo); // Se não tiver tipo definido, assume como comida
            const itemsHtml = foodItems.map(item => 
                `<div class="order-item">${item.quantity}x ${item.name}</div>`
            ).join('');
            
            // Só mostra o card se tiver itens de comida
            if (foodItems.length > 0) {
                orderCard.innerHTML = `
                    <div class="order-header">
                        <div class="order-number">#${order.id}</div>
                        <div class="order-table">Mesa ${order.mesa}</div>
                    </div>
                    <div class="order-time">${timeDiff} min</div>
                    <div class="order-items">
                        ${itemsHtml}
                    </div>
                    <div class="order-status status-${order.status}">${getStatusText(order.status)}</div>
                    <div class="order-actions">
                        ${getActionButtons(order)}
                    </div>
                `;
                
                ordersContainer.appendChild(orderCard);
            }
        }
    });
    
    // Atualizar contadores
    document.getElementById('pending-count').textContent = pendingCount;
    document.getElementById('preparing-count').textContent = preparingCount;
}

// Função para renderizar pedidos de bebidas (separado)
function renderBebidaOrders() {
    // Para esta implementação, os pedidos de bebidas seriam mostrados em outro container
    // ou poderíamos ter uma aba separada ou seção dentro da cozinha
}

// Função para obter texto do status
function getStatusText(status) {
    const statusMap = {
        'pendente': 'Pendente',
        'em_preparo': 'Em Preparo',
        'pronto': 'Pronto',
        'entregue': 'Entregue',
        'cancelado': 'Cancelado'
    };
    return statusMap[status] || status;
}

// Função para obter botões de ação
function getActionButtons(order) {
    let buttons = '';
    
    if (order.status === 'pendente') {
        buttons += '<button class="action-btn btn-start" onclick="startPreparation(' + order.id + ')">Iniciar Preparo</button>';
    } else if (order.status === 'em_preparo') {
        buttons += '<button class="action-btn btn-ready" onclick="markAsReady(' + order.id + ')">Pronto</button>';
    } else if (order.status === 'pronto') {
        buttons += '<button class="action-btn btn-delivered" onclick="markAsDelivered(' + order.id + ')">Entregue</button>';
    }
    
    return buttons;
}

// Função para iniciar preparação
function startPreparation(orderId) {
    socket.emit('atualizar_status', {
        id: orderId,
        status: 'em_preparo'
    });
}

// Função para marcar como pronto
function markAsReady(orderId) {
    socket.emit('atualizar_status', {
        id: orderId,
        status: 'pronto'
    });
}

// Função para marcar como entregue
function markAsDelivered(orderId) {
    socket.emit('atualizar_status', {
        id: orderId,
        status: 'entregue'
    });
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Solicitar pedidos iniciais
    socket.emit('obter_pedidos');
    
    // Listener para atualizações de pedidos
    socket.on('pedidos_atualizados', function(updatedOrders) {
        orders = updatedOrders;
        renderOrders();
    });
    
    // Listener para novos pedidos na cozinha
    socket.on('novo_pedido_cozinha', function(data) {
        playKitchenNotificationSound(); // Som agressivo para cozinha
        socket.emit('obter_pedidos');
    });
    
    // Listener para atualizações em tempo real
    socket.on('pedido_atualizado', function(data) {
        // Atualizar pedido específico ou recarregar lista
        socket.emit('obter_pedidos');
    });
});

// Atualizar a cada 30 segundos automaticamente
setInterval(() => {
    socket.emit('obter_pedidos');
}, 30000);