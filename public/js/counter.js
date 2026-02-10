// Balcão Socket.IO
const counterSocket = io();

// Registrar o socket na sala do balcão
counterSocket.emit('join_room', 'balcao');

let orders = [];

// Função para tocar som de notificação suave (para balcão)
function playCounterNotificationSound() {
    const audio = new Audio('/sounds/counter-notification.mp3');
    audio.play().catch(e => console.log('Erro ao tocar áudio do balcão:', e));
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
            
            // Formatar itens do pedido - mostrar apenas itens de bebida
            const drinkItems = order.itens.filter(item => item.tipo === 'bebida');
            const itemsHtml = drinkItems.map(item => 
                `<div class="order-item">${item.quantity}x ${item.name}</div>`
            ).join('');
            
            // Só mostra o card se tiver itens de bebida
            if (drinkItems.length > 0) {
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
    counterSocket.emit('atualizar_status', {
        id: orderId,
        status: 'em_preparo'
    });
}

// Função para marcar como pronto
function markAsReady(orderId) {
    counterSocket.emit('atualizar_status', {
        id: orderId,
        status: 'pronto'
    });
}

// Função para marcar como entregue
function markAsDelivered(orderId) {
    counterSocket.emit('atualizar_status', {
        id: orderId,
        status: 'entregue'
    });
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Solicitar pedidos iniciais
    counterSocket.emit('obter_pedidos_bebidas');
    
    // Listener para atualizações de pedidos
    counterSocket.on('pedidos_bebidas_atualizados', function(updatedOrders) {
        orders = updatedOrders;
        renderOrders();
    });
    
    // Listener para novos pedidos de bebidas no balcão
    counterSocket.on('novo_pedido_bebida', function(data) {
        playCounterNotificationSound(); // Som suave para balcão
        counterSocket.emit('obter_pedidos_bebidas');
    });
    
    // Listener para atualizações em tempo real
    counterSocket.on('pedido_atualizado', function(data) {
        // Atualizar pedido específico ou recarregar lista
        counterSocket.emit('obter_pedidos_bebidas');
    });
});

// Atualizar a cada 30 segundos automaticamente
setInterval(() => {
    counterSocket.emit('obter_pedidos_bebidas');
}, 30000);