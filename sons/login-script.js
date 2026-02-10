// login-script.js
const TABLE_USERNAME = 'coldfoxgg'; // Nome de usuário para acesso à tabela
const TABLE_ACCESS_PASSWORD = 'foxcoldgg25'; // Senha para acesso à tabela
const TABLE_ACCESS_KEY = 'coldfoxTableLoggedIn'; // Chave para armazenar o status de login na sessionStorage

// Referências aos elementos HTML
const usernameInput = document.getElementById('usernameInput');
const passwordInput = document.getElementById('passwordInput');
const loginButton = document.getElementById('loginButton');
const loginMessage = document.getElementById('loginMessage');

// Adiciona um ouvinte de evento para o clique do botão de login
loginButton.addEventListener('click', () => {
    const enteredUsername = usernameInput.value; // Obtém o valor digitado no campo de usuário
    const enteredPassword = passwordInput.value; // Obtém o valor digitado no campo de senha

    // Verifica se o usuário e a senha correspondem às credenciais definidas
    if (enteredUsername === TABLE_USERNAME && enteredPassword === TABLE_ACCESS_PASSWORD) {
        // Se as credenciais estiverem corretas, salva o status de login na sessionStorage
        sessionStorage.setItem(TABLE_ACCESS_KEY, 'true');
        loginMessage.className = 'message success'; // Define a classe para mensagem de sucesso
        loginMessage.textContent = 'Login bem-sucedido! Redirecionando...'; // Exibe mensagem de sucesso
        
        // Redireciona para a página da tabela após 1 segundo
        setTimeout(() => {
            window.location.href = 'tabela.html';
        }, 1000); 
    } else {
        // Se as credenciais estiverem incorretas, exibe mensagem de erro
        loginMessage.className = 'message error'; // Define a classe para mensagem de erro
        loginMessage.textContent = 'Usuário ou senha incorretos. Tente novamente.'; // Exibe mensagem de erro
    }
    // Limpa o campo da senha após a tentativa de login (mantém o usuário preenchido)
    passwordInput.value = ''; 
});

// Adiciona um ouvinte de evento para a tecla 'Enter' no campo de usuário
usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        loginButton.click(); // Simula um clique no botão de login
    }
});

// Adiciona um ouvinte de evento para a tecla 'Enter' no campo de senha
passwordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        loginButton.click(); // Simula um clique no botão de login
    }
});

// Verifica o status de login ao carregar a página
document.addEventListener('DOMContentLoaded', () => {
    const hasAccess = sessionStorage.getItem(TABLE_ACCESS_KEY) === 'true';
    if (hasAccess) {
        // Se o usuário já tiver acesso à tabela (ou seja, já logou), redireciona diretamente
        window.location.href = 'tabela.html';
    }
});