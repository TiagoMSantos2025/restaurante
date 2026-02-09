// Cliente Socket.IO
const socket = io();

let cart = [];
let tableNumber = document.querySelector('h1').textContent.match(/Mesa (\d+)/)?.[1] || '01';

// Função para carregar os itens do cardápio
async function loadMenuItems() {
    try {
        const response = await fetch('/api/products');
        const products = await response.json();
        
        const menuGrid = document.getElementById('menu-items');
        menuGrid.innerHTML = '';
        
        products.forEach(product => {
            const menuItem = document.createElement('div');
            menuItem.className = 'menu-item';
            menuItem.innerHTML = `
                <h3>${product.nome}</h3>
                <p>${product.descricao}</p>
                <div class="price">R$ ${parseFloat(product.preco).toFixed(2)}</div>
                <button class="add-to-cart-btn" onclick="addToCart(${product.id}, '${product.nome}', ${product.preco})">Adicionar</button>
            `;
            menuGrid.appendChild(menuItem);
        });
    } catch (error) {
        console.error('Erro ao carregar cardápio:', error);
    }
}

// Função para adicionar item ao carrinho
function addToCart(id, name, price) {
    const existingItem = cart.find(item => item.id === id);
    
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({ id, name, price, quantity: 1 });
    }
    
    updateCartDisplay();
}

// Função para remover item do carrinho
function removeFromCart(index) {
    cart.splice(index, 1);
    updateCartDisplay();
}

// Função para atualizar a exibição do carrinho
function updateCartDisplay() {
    // Atualizar contagem e total no cabeçalho
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    document.getElementById('cart-count').textContent = totalItems;
    document.getElementById('cart-total').textContent = totalPrice.toFixed(2);
    
    // Atualizar itens do carrinho
    const cartItemsDiv = document.getElementById('cart-items');
    cartItemsDiv.innerHTML = '';
    
    cart.forEach((item, index) => {
        const cartItem = document.createElement('div');
        cartItem.className = 'cart-item';
        cartItem.innerHTML = `
            <div>
                <strong>${item.name}</strong> x${item.quantity}
            </div>
            <div>
                R$ ${(item.price * item.quantity).toFixed(2)}
                <button onclick="removeFromCart(${index})" style="margin-left: 10px; background-color: #e74c3c; color: white; border: none; padding: 3px 6px; border-radius: 3px; cursor: pointer;">Remover</button>
            </div>
        `;
        cartItemsDiv.appendChild(cartItem);
    });
}

// Função para enviar o pedido
async function sendOrder() {
    if (cart.length === 0) {
        alert('O carrinho está vazio!');
        return;
    }
    
    const order = {
        mesa: tableNumber,
        itens: cart.map(item => ({
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity
        })),
        total: cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    };
    
    try {
        // Enviar pedido via socket
        socket.emit('novo_pedido', order);
        
        // Limpar carrinho após envio
        cart = [];
        updateCartDisplay();
        
        alert('Pedido enviado com sucesso!');
    } catch (error) {
        console.error('Erro ao enviar pedido:', error);
        alert('Erro ao enviar pedido. Tente novamente.');
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    loadMenuItems();
    
    // Eventos dos botões
    document.getElementById('send-order').addEventListener('click', sendOrder);
    document.getElementById('clear-cart').addEventListener('click', function() {
        cart = [];
        updateCartDisplay();
    });
    
    // Eventos das categorias
    const categoryButtons = document.querySelectorAll('.category-btn');
    categoryButtons.forEach(button => {
        button.addEventListener('click', function() {
            categoryButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            const category = this.getAttribute('data-category');
            filterMenuItems(category);
        });
    });
});

// Função para filtrar itens por categoria (simulação)
function filterMenuItems(category) {
    // Esta função seria expandida para realmente filtrar os itens
    // Por enquanto, apenas recarrega todos os itens
    loadMenuItems();
}

// Listener para atualizações em tempo real
socket.on('pedido_atualizado', function(data) {
    // Atualizações de status do pedido seriam tratadas aqui
    console.log('Pedido atualizado:', data);
});