# Guerra de Pizzas

Cardápio, conta do cliente, carrinho e pedidos integrados ao SQLite.

## Abrir no Windows

As dependências já foram instaladas neste computador. Dê dois cliques em
`iniciar.cmd`, mantenha a janela aberta e acesse http://127.0.0.1:3000.
O iniciador usa uma versão compatível do Node disponível no computador, sem
alterar a instalação global. Para encerrar, use Ctrl+C na janela do servidor.
Não abra `frontend/index.html` diretamente ou por Live Server: a API e o frontend
são servidos pelo mesmo backend.

## Instalação em outro computador

Use Node.js 22.13 ou superior (recomendado: Node 24).

```sh
cd backend
npm ci
npm start
```

O primeiro início cria/migra `backend/data/guerra_pizzas.sqlite` e importa as três
pizzas que já estavam no frontend (R$ 45, R$ 48 e R$ 55), somente se não existir
nenhuma pizza. Não cria usuários, senhas ou pedidos de exemplo. As migrações
preservam dados existentes. Faça cópia do arquivo SQLite com o servidor parado
para guardar um backup consistente.

## Funcionalidades

- Cardápio carregado do banco, respeitando disponibilidade e categorias ativas.
- Bordas e adicionais são exibidos quando cadastrados para a pizza no banco.
- Carrinho salvo neste navegador, com quantidades, personalizações e observações.
- Cadastro, login, sessão de 7 dias e logout que revoga a sessão.
- Cadastro de endereços, escolha do endereço de entrega e endereço principal.
- Checkout com cálculo em centavos pelo servidor, sem confiar nos preços do navegador.
- Pedido, itens, pagamento pendente, entrega e notificação gravados na mesma transação.
- Reenvio da mesma compra com a mesma chave não cria pedidos duplicados.
- Histórico e notificações separados por cliente; nomes, opções, preços e endereço
  são preservados no momento da compra.
- Falhas não limpam o carrinho; alterações de preço exigem nova confirmação.

## Entrega e pagamento

O frete padrão é R$ 0,00, pois o projeto não tinha uma taxa definida.
Copie `backend/.env.example` para `backend/.env` e ajuste
`TAXA_ENTREGA_CENTAVOS=500`, por exemplo, para cobrar R$ 5,00. Reinicie o servidor.
Também é possível configurar PORT, HOST e DATABASE_PATH.

Pagamento disponível: dinheiro ou cartão **na entrega**. A aplicação não cobra
cartões, não gera Pix, não envia SMS/e-mail e não se comunica com entregadores.
As notificações aparecem dentro do site. Pedidos aguardam confirmação; as telas
mostram os estados gravados no banco ao atualizar a lista. Um painel administrativo
para operar a cozinha, alterar cardápio/status e atribuir entregadores não faz
parte desta interface de cliente.

## Segurança e execução

Senhas usam scrypt com salt individual. O cookie de sessão é HttpOnly e SameSite=Strict;
o banco guarda somente o hash do token. Rotas privadas verificam o proprietário;
as mutações exigem JSON e bloqueiam origens externas. Login/cadastro têm limite de
30 tentativas por IP a cada 15 minutos. O servidor abre somente em 127.0.0.1 por padrão.
Para publicação, configure HTTPS e NODE_ENV=production; não há implantação pública
nesta entrega. Bootstrap e fotos usam os mesmos serviços externos do frontend original.

## Testes

```sh
cd backend
npm test
```

A suíte verifica autenticação, sessão, isolamento entre clientes, catálogo,
validações, personalizações, preços calculados no servidor, idempotência,
rollback transacional e persistência após reabrir SQLite. Usa banco em memória
ou arquivo temporário, sem inserir dados de teste no banco do projeto.

Também foi validado no navegador: cadastro durante checkout, cadastro de endereço,
pizza com borda/adicional/observação, compra, histórico após recarregar, leitura de
notificação, recuperação do histórico ao sair e entrar novamente e falha de conexão
no checkout sem limpar o carrinho.

## API

- GET /api/config e GET /api/cardapio: configuração e catálogo público.
- POST /api/auth/cadastro: nome, email e senha (8 a 128 caracteres).
- POST /api/auth/login; GET /api/auth/me; POST /api/auth/logout.
- GET/POST /api/enderecos: endereços do cliente autenticado.
- GET /api/pedidos e GET /api/pedidos/:id: histórico do cliente.
- POST /api/pedidos: exige cabeçalho Idempotency-Key (16–100 caracteres).
  Corpo: endereco_id, forma_pagamento, itens e total_esperado_centavos opcional.
  Cada item: pizza_id, quantidade, borda_id opcional, adicionais_ids e observacao.
- GET /api/notificacoes; PATCH /api/notificacoes/:id: listar e marcar como lida.

Todos os POST/PATCH usam Content-Type: application/json, inclusive logout ({}).
