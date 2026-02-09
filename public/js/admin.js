// Admin Socket.IO
const socket = io();

let tables = [];
let currentTable = null;
let tableOrders = [];

// Função para carregar mesas
async function loadTables() {
    try {
        const response = await fetch('/api/tables');
        tables = await response.json();
        
        const tablesGrid = document.getElementById('tables-grid');
        tablesGrid.innerHTML = '';
        
        tables.forEach(table => {
            const tableItem = document.createElement('div');
            tableItem.className = `table-item ${table.status}`;
            tableItem.textContent = `Mesa ${table.numero}`;
            tableItem.onclick = () => selectTable(table.id, table.numero);
            tablesGrid.appendChild(tableItem);
        });
    } catch (error) {
        console.error('Erro ao carregar mesas:', error);
    }
}

// Função para selecionar mesa
function selectTable(tableId, tableNumber) {
    currentTable = tableId;
    document.getElementById('current-table').textContent = tableNumber;
    
    loadTableOrders(tableId);
    
    // Destacar mesa selecionada
    document.querySelectorAll('.table-item').forEach(item => {
        item.style.border = 'none';
    });
    
    event.target.style.border = '2px solid #3498db';
}

// Função para carregar pedidos da mesa
async function loadTableOrders(tableId) {
    try {
        const response = await fetch(`/api/table-orders/${tableId}`);
        tableOrders = await response.json();
        
        const tableOrdersDiv = document.getElementById('table-orders');
        tableOrdersDiv.innerHTML = '';
        
        tableOrders.forEach(order => {
            const orderItem = document.createElement('div');
            orderItem.className = 'order-item';
            
            // Formatar itens do pedido
            const itemsHtml = order.itens.map(item => 
                `${item.quantity}x ${item.name}`
            ).join(', ');
            
            orderItem.innerHTML = `
                <div><strong>#${order.id}</strong> - ${itemsHtml}</div>
                <div>Status: ${getStatusText(order.status)} | Total: R$ ${order.total}</div>
            `;
            tableOrdersDiv.appendChild(orderItem);
        });
    } catch (error) {
        console.error('Erro ao carregar pedidos da mesa:', error);
    }
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

// Função para finalizar pedido
async function finalizeOrder() {
    if (!currentTable) {
        alert('Selecione uma mesa primeiro!');
        return;
    }
    
    if (confirm('Tem certeza que deseja finalizar o pedido?')) {
        try {
            const response = await fetch('/api/finalize-order', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ tableId: currentTable })
            });
            
            if (response.ok) {
                alert('Pedido finalizado com sucesso!');
                loadTableOrders(currentTable);
            } else {
                alert('Erro ao finalizar pedido');
            }
        } catch (error) {
            console.error('Erro ao finalizar pedido:', error);
            alert('Erro ao finalizar pedido');
        }
    }
}

// Função para imprimir comanda
function printReceipt() {
    if (!currentTable) {
        alert('Selecione uma mesa primeiro!');
        return;
    }
    
    // Criar conteúdo para impressão
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
            <head>
                <title>Comanda Mesa ${currentTable}</title>
                <style>
                    body { font-family: monospace; width: 80mm; margin: 0; }
                    .header { text-align: center; margin-bottom: 10px; }
                    .item { display: flex; justify-content: space-between; margin: 5px 0; }
                    .total { margin-top: 10px; padding-top: 5px; border-top: 1px solid black; font-weight: bold; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h2>COMANDA</h2>
                    <p>Mesa: ${currentTable}</p>
                    <p>Data: ${new Date().toLocaleDateString()}</p>
                    <p>Hora: ${new Date().toLocaleTimeString()}</p>
                </div>
                <div class="items">
                    ${tableOrders.map(order => `
                        <div class="item">
                            <span>${order.id} - ${order.itens.map(i => i.quantity + 'x ' + i.name).join(', ')}</span>
                            <span>R$ ${order.total}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="total">
                    <div class="item">
                        <span>TOTAL:</span>
                        <span>R$ ${tableOrders.reduce((sum, order) => sum + parseFloat(order.total || 0), 0).toFixed(2)}</span>
                    </div>
                </div>
            </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    loadTables();
    
    // Eventos dos botões
    document.getElementById('finalize-order').addEventListener('click', finalizeOrder);
    document.getElementById('print-receipt').addEventListener('click', printReceipt);
    
    // Listener para atualizações em tempo real
    socket.on('pedido_atualizado', function(data) {
        // Se o pedido for da mesa atual, atualizar
        if (currentTable && data.mesa === currentTable) {
            loadTableOrders(currentTable);
        }
        // Atualizar mesas também
        loadTables();
    });
});

// Função para atualizar estatísticas
function updateStats() {
    fetch('/api/today-stats')
        .then(response => response.json())
        .then(stats => {
            document.getElementById('today-orders').textContent = stats.orders;
            document.getElementById('today-revenue').textContent = `R$ ${stats.revenue}`;
        })
        .catch(error => console.error('Erro ao atualizar estatísticas:', error));
}

// Atualizar estatísticas a cada 30 segundos
setInterval(updateStats, 30000);
updateStats(); // Carregar imediatamente