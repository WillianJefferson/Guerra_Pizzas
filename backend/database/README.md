# Banco de dados — Guerra de Pizzas

SQLite nativo do Node.js 22.13 ou superior, sem compilação adicional no Windows.
O banco local fica em `backend/data/guerra_pizzas.sqlite` e não é versionado.

```sh
npm run db:init
npm run db:seed
```

`npm start` também inicializa o banco e importa o cardápio original, se vazio.
Veja o README da raiz para iniciar o frontend integrado.

## Modelo

As 12 tabelas do diagrama ficam em schema.sql: usuarios, enderecos, pedidos,
itens_pedido, pizzas, categorias, adicionais, bordas, pagamentos, entregadores,
entregas e notificacoes. Chaves estrangeiras são habilitadas a cada conexão.
Exclusões de registros referenciados são bloqueadas para preservar histórico.
Há no máximo um endereço principal por usuário; o endereço do pedido deve
pertencer ao cliente. Entregas seguem a alternativa 1:N do diagrama.

A inicialização em index.js adiciona, sem apagar dados existentes:
- sessoes: hashes dos tokens de acesso, usuário e expiração.
- pedidos.chave_checkout: evita duplicação da mesma compra por usuário.
- pedidos.endereco_json: endereço no momento da compra.
- itens_pedido.nome_pizza e opcoes_json: nome e bordas/adicionais comprados,
  incluindo identificadores, nomes e preços históricos.

Booleanos usam 0/1; datas de criação são UTC. Os tipos DECIMAL do SQLite possuem
afinidade numérica, não precisão decimal fixa. A API calcula e soma em centavos
inteiros e só converte para reais ao gravar. O subtotal inclui bordas/adicionais;
o total inclui frete. Pagamentos são registrados como pendentes na entrega.

Usuários criados pela API recebem senha_hash em formato scrypt$salt$hash.
Não grave senhas em texto puro. O arquivo SQLite contém dados pessoais e deve
ser mantido fora do Git. Para backup, pare o servidor antes de copiar o arquivo.
