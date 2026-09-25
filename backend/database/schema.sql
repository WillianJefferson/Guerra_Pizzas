-- Guerra de Pizzas: esquema SQLite baseado no diagrama.
-- Habilite PRAGMA foreign_keys = ON em cada conexão.
CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome VARCHAR(150) NOT NULL,
    email VARCHAR(254) NOT NULL COLLATE NOCASE UNIQUE,
    senha_hash VARCHAR(255) NOT NULL,
    role VARCHAR(30) NOT NULL DEFAULT 'cliente',
    ativo BOOLEAN NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS enderecos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
    rua VARCHAR(200) NOT NULL,
    numero VARCHAR(20) NOT NULL,
    complemento VARCHAR(150),
    bairro VARCHAR(100) NOT NULL,
    cidade VARCHAR(100) NOT NULL,
    estado VARCHAR(2) NOT NULL CHECK (length(estado) = 2),
    cep VARCHAR(9) NOT NULL,
    principal BOOLEAN NOT NULL DEFAULT 0 CHECK (principal IN (0, 1)),
    UNIQUE (id, usuario_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_enderecos_principal ON enderecos(usuario_id) WHERE principal = 1;
CREATE TABLE IF NOT EXISTS categorias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome VARCHAR(100) NOT NULL,
    descricao VARCHAR(255),
    ativo BOOLEAN NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1))
);
CREATE TABLE IF NOT EXISTS pizzas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    categoria_id INTEGER NOT NULL REFERENCES categorias(id),
    nome VARCHAR(150) NOT NULL,
    descricao TEXT,
    preco DECIMAL(10, 2) NOT NULL CHECK (preco >= 0),
    disponivel BOOLEAN NOT NULL DEFAULT 1 CHECK (disponivel IN (0, 1)),
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS adicionais (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pizza_id INTEGER NOT NULL REFERENCES pizzas(id),
    nome VARCHAR(100) NOT NULL,
    preco DECIMAL(10, 2) NOT NULL CHECK (preco >= 0),
    disponivel BOOLEAN NOT NULL DEFAULT 1 CHECK (disponivel IN (0, 1))
);
CREATE TABLE IF NOT EXISTS bordas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pizza_id INTEGER NOT NULL REFERENCES pizzas(id),
    nome VARCHAR(100) NOT NULL,
    preco DECIMAL(10, 2) NOT NULL CHECK (preco >= 0),
    disponivel BOOLEAN NOT NULL DEFAULT 1 CHECK (disponivel IN (0, 1))
);
CREATE TABLE IF NOT EXISTS pedidos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
    status VARCHAR(30) NOT NULL DEFAULT 'pendente',
    subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
    taxa_entrega DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (taxa_entrega >= 0),
    desconto DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (desconto >= 0 AND desconto <= subtotal + taxa_entrega),
    total DECIMAL(10, 2) NOT NULL CHECK (total >= 0),
    endereco_id INTEGER NOT NULL REFERENCES enderecos(id),
    forma_pagamento VARCHAR(30) NOT NULL,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (endereco_id, usuario_id) REFERENCES enderecos(id, usuario_id),
    CHECK (round(total * 100) = round(subtotal * 100) + round(taxa_entrega * 100) - round(desconto * 100))
);
CREATE TABLE IF NOT EXISTS itens_pedido (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pedido_id INTEGER NOT NULL REFERENCES pedidos(id),
    pizza_id INTEGER NOT NULL REFERENCES pizzas(id),
    quantidade INTEGER NOT NULL CHECK (typeof(quantidade) = 'integer' AND quantidade > 0),
    preco_unitario DECIMAL(10, 2) NOT NULL CHECK (preco_unitario >= 0),
    observacao VARCHAR(500)
);
CREATE TABLE IF NOT EXISTS pagamentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pedido_id INTEGER NOT NULL REFERENCES pedidos(id),
    metodo VARCHAR(30) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'pendente',
    valor DECIMAL(10, 2) NOT NULL CHECK (valor >= 0),
    transacao_id VARCHAR(150),
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS entregadores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome VARCHAR(150) NOT NULL,
    telefone VARCHAR(20) NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1))
);
CREATE TABLE IF NOT EXISTS entregas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pedido_id INTEGER NOT NULL REFERENCES pedidos(id),
    entregador_id INTEGER REFERENCES entregadores(id),
    status VARCHAR(30) NOT NULL DEFAULT 'pendente',
    codigo_rastreamento VARCHAR(100) UNIQUE,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS notificacoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
    pedido_id INTEGER REFERENCES pedidos(id),
    tipo VARCHAR(40) NOT NULL,
    mensagem TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'pendente',
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_enderecos_usuario_id ON enderecos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_pizzas_categoria_id ON pizzas(categoria_id);
CREATE INDEX IF NOT EXISTS idx_adicionais_pizza_id ON adicionais(pizza_id);
CREATE INDEX IF NOT EXISTS idx_bordas_pizza_id ON bordas(pizza_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_usuario_id ON pedidos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_endereco_id ON pedidos(endereco_id);
CREATE INDEX IF NOT EXISTS idx_itens_pedido_pedido_id ON itens_pedido(pedido_id);
CREATE INDEX IF NOT EXISTS idx_itens_pedido_pizza_id ON itens_pedido(pizza_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_pedido_id ON pagamentos(pedido_id);
CREATE INDEX IF NOT EXISTS idx_entregas_pedido_id ON entregas(pedido_id);
CREATE INDEX IF NOT EXISTS idx_entregas_entregador_id ON entregas(entregador_id);
CREATE INDEX IF NOT EXISTS idx_notificacoes_usuario_id ON notificacoes(usuario_id);
CREATE INDEX IF NOT EXISTS idx_notificacoes_pedido_id ON notificacoes(pedido_id);
