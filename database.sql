-- Banco de dados para o sistema de restaurante
CREATE DATABASE IF NOT EXISTS restaurante_db;
USE restaurante_db;

-- Tabela de mesas
CREATE TABLE mesas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    numero VARCHAR(10) NOT NULL UNIQUE,
    capacidade INT DEFAULT 4,
    status ENUM('disponivel', 'ocupada', 'reservada') DEFAULT 'disponivel',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de categorias de produtos
CREATE TABLE categorias (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    descricao TEXT,
    status ENUM('ativo', 'inativo') DEFAULT 'ativo'
);

-- Tabela de produtos
CREATE TABLE produtos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(200) NOT NULL,
    descricao TEXT,
    preco DECIMAL(10, 2) NOT NULL,
    categoria_id INT,
    imagem VARCHAR(255),
    status ENUM('ativo', 'inativo') DEFAULT 'ativo',
    FOREIGN KEY (categoria_id) REFERENCES categorias(id)
);

-- Tabela de pedidos
CREATE TABLE pedidos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    mesa_id INT,
    itens JSON NOT NULL,
    status ENUM('pendente', 'em_preparo', 'pronto', 'entregue', 'cancelado') DEFAULT 'pendente',
    hora_pedido TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    hora_inicio_preparo TIMESTAMP NULL,
    hora_finalizacao TIMESTAMP NULL,
    total DECIMAL(10, 2),
    FOREIGN KEY (mesa_id) REFERENCES mesas(id)
);

-- Inserir algumas categorias padrão
INSERT INTO categorias (nome, descricao) VALUES
('Entradas', 'Pratos iniciais para abrir o apetite'),
('Pratos Principais', 'Pratos principais do cardápio'),
('Bebidas', 'Bebidas alcoólicas e não alcoólicas'),
('Sobremesas', 'Doces e sobremesas para finalizar a refeição');

-- Inserir alguns produtos de exemplo
INSERT INTO produtos (nome, descricao, preco, categoria_id) VALUES
('Camarão àgil', 'Camarões grelhados com alho e ervas', 35.00, 1),
('Salada Caesar', 'Salada com frango grelhado, croutons e molho Caesar', 28.00, 1),
('Filé Mignon', 'Filé mignon grelhado com batatas sauté', 65.00, 2),
('Frango Grelhado', 'Peito de frango grelhado com legumes', 42.00, 2),
('Refrigerante', 'Refrigerante lata 350ml', 8.00, 3),
('Suco Natural', 'Suco de laranja natural 500ml', 12.00, 3),
('Pudim', 'Pudim de leite condensado tradicional', 15.00, 4),
('Brownie', 'Brownie com sorvete de baunilha', 18.00, 4);

-- Inserir algumas mesas
INSERT INTO mesas (numero, capacidade) VALUES
('01', 4), ('02', 4), ('03', 4), ('04', 4), ('05', 4),
('06', 4), ('07', 4), ('08', 4), ('09', 4), ('10', 4);