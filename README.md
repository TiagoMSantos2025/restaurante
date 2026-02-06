# Restaurante Estradeiro - Sistema de Gestão de Restaurantes

Sistema completo de gestão de restaurantes com cardápio digital baseado em QR code, integração entre cliente, balcão e cozinha.

## Funcionalidades

### Cardápio Digital
- Acesso via código QR nas mesas
- Interface amigável para navegação no cardápio
- Suporte a múltiplas categorias (lanches, pizzas, bebidas, etc.)

### Integração entre Departamentos
- Cliente faz pedidos diretamente pelo celular
- Pedidos são enviados ao balcão para confirmação
- Após confirmação, pedidos vão para a cozinha
- Interface dedicada para balcão e cozinha

### Autenticação e Autorização
- Sistema de login com diferentes papéis (admin, manager, counter, kitchen, client)
- Controle de acesso baseado em papéis

### Notificações em Tempo Real
- Sistema de notificações usando Socket.IO
- Atualizações instantâneas sobre o status dos pedidos

### Análise e Relatórios
- Painel de análise de vendas
- Produtos mais vendidos
- Estatísticas de desempenho

### Sistema de Fidelidade
- Programa de pontos por compras
- Níveis de fidelidade (bronze, prata, ouro, platina)
- Recompensas resgatáveis com pontos

### Multilíngue
- Suporte a Português, Inglês e Espanhol
- Interface de troca de idioma

### Backup Automático
- Sistema de backup de dados
- Exportação de informações importantes

## Tecnologias Utilizadas

- **Backend**: Node.js com Express
- **Database**: MongoDB com Mongoose
- **Frontend**: HTML, CSS, JavaScript
- **Real-time**: Socket.IO
- **QR Code**: QRCode library
- **Autenticação**: JWT
- **Internacionalização**: Sistema próprio de tradução

## Instalação

1. Clone este repositório
2. Execute `npm install` para instalar as dependências
3. Configure o arquivo `.env` com suas variáveis de ambiente
4. Execute `npm start` para iniciar o servidor
5. Acesse `http://localhost:3000` para usar o sistema

## Configuração

Antes de executar o sistema, configure o arquivo `.env` com:

```
MONGODB_URI=sua_conexao_mongo_aqui
JWT_SECRET=sua_chave_secreta_jwt_aqui
PORT=porta_para_o_servidor_aqui
```

## Uso

### Para Clientes
1. Acesse o sistema escaneando o código QR da mesa
2. Insira seu nome
3. Escolha os itens do cardápio
4. Finalize o pedido

### Para Balcão
1. Acesse `/counter` e faça login
2. Veja os pedidos recebidos
3. Confirme os pedidos para envio à cozinha

### Para Cozinha
1. Acesse `/kitchen` e faça login
2. Veja os pedidos confirmados
3. Atualize o status conforme o preparo

## API Endpoints

- `GET /api/cardapio` - Obter itens do cardápio
- `POST /api/pedidos` - Criar novo pedido
- `PUT /api/pedidos/:id/status` - Atualizar status do pedido
- `POST /api/auth/login` - Login de usuário
- `GET /api/fidelidade/:userId` - Obter informações de fidelidade
- `POST /api/fidelidade/resgatar` - Resgatar recompensa

## Contribuição

Sinta-se à vontade para contribuir com este projeto. Abra uma issue para discutir mudanças ou envie um pull request.

## Licença

Este projeto está licenciado sob os termos descritos conforme aplicável.