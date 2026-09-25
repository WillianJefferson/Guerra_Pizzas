const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { mkdtempSync, rmSync, readFileSync } = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const { openDatabase } = require('../database');
const { createApp } = require('../app');
let db, server, base;
beforeEach(async () => {
    db = openDatabase(':memory:');
    const app = createApp({ db, deliveryCents: 500 });
    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    base = `http://127.0.0.1:${server.address().port}`;
});
afterEach(async () => { await new Promise(resolve => server.close(resolve)); db.close(); });
async function request(route, { method = 'GET', body, cookie, headers = {} } = {}) {
    const response = await fetch(base + '/api' + route, { method, headers: { ...(method !== 'GET' ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0], headers: response.headers };
}
async function register(mail = 'cliente@example.test') {
    const result = await request('/auth/cadastro', { method: 'POST', body: { nome: 'Cliente Teste', email: mail, senha: 'SenhaTeste123!' } });
    assert.equal(result.status, 201, JSON.stringify(result.data)); return result;
}
const address = { rua: 'Rua de Teste', numero: '10', complemento: 'Casa', bairro: 'Centro', cidade: 'Fortaleza', estado: 'CE', cep: '60000-000', principal: true };
async function customer(mail) {
    const user = await register(mail);
    const result = await request('/enderecos', { method: 'POST', cookie: user.cookie, body: address });
    assert.equal(result.status, 201); return { cookie: user.cookie, address: result.data, id: user.data.id };
}
const orderBody = addressId => ({ endereco_id: addressId, forma_pagamento: 'dinheiro', itens: [{ pizza_id: 1, quantidade: 2 }] });
const order = (user, body = orderBody(user.address.id), key = randomUUID()) => request('/pedidos', { method: 'POST', cookie: user.cookie, body, headers: { 'Idempotency-Key': key } });

test('cardápio vem do banco e frontend é servido pela mesma aplicação', async () => {
    const menu = await request('/cardapio');
    assert.equal(menu.status, 200); assert.equal(menu.data.length, 3);
    db.prepare('UPDATE pizzas SET disponivel=0 WHERE id=1').run();
    assert.equal((await request('/cardapio')).data.length, 2);
    db.prepare('UPDATE categorias SET ativo=0').run();
    assert.equal((await request('/cardapio')).data.length, 0);
    const page = await fetch(base); assert.equal(page.status, 200); assert.match(await page.text(), /Guerra de Pizzas/);
    assert.match(page.headers.get('content-security-policy'), /script-src 'self'/);
});

test('cadastro, senha protegida, login, sessão e revogação no logout', async () => {
    const user = await register();
    assert.equal(user.data.senha_hash, undefined);
    assert.match(user.headers.get('set-cookie'), /HttpOnly/);
    assert.match(user.headers.get('set-cookie'), /SameSite=Strict/);
    assert.match(db.prepare('SELECT senha_hash FROM usuarios').get().senha_hash, /^scrypt\$/);
    assert.notEqual(db.prepare('SELECT token_hash FROM sessoes').get().token_hash, user.cookie.split('=')[1]);
    assert.equal((await request('/auth/me', { cookie: user.cookie })).status, 200);
    assert.equal((await request('/auth/cadastro', { method: 'POST', body: { nome: 'Outro', email: 'CLIENTE@example.test', senha: 'SenhaTeste123!' } })).status, 409);
    assert.equal((await request('/auth/login', { method: 'POST', body: { email: 'cliente@example.test', senha: 'senha-errada' } })).status, 401);
    const login = await request('/auth/login', { method: 'POST', body: { email: 'cliente@example.test', senha: 'SenhaTeste123!' } });
    assert.equal(login.status, 200);
    await request('/auth/logout', { method: 'POST', cookie: login.cookie, body: {} });
    assert.equal((await request('/auth/me', { cookie: login.cookie })).status, 401);
    db.prepare('UPDATE sessoes SET expira_em=0').run();
    assert.equal((await request('/auth/me', { cookie: user.cookie })).status, 401);
});

test('endereço principal único e validação de CEP/UF', async () => {
    const user = await customer();
    assert.equal((await request('/enderecos', { method: 'POST', cookie: user.cookie, body: { ...address, numero: '20' } })).status, 201);
    const list = (await request('/enderecos', { cookie: user.cookie })).data;
    assert.equal(list.length, 2); assert.equal(list.filter(a => a.principal).length, 1);
    assert.equal((await request('/enderecos', { method: 'POST', cookie: user.cookie, body: { ...address, estado: 'XX' } })).status, 400);
    assert.equal((await request('/enderecos', { method: 'POST', cookie: user.cookie, body: { ...address, cep: '12' } })).status, 400);
});

test('pedido calcula preços no servidor e grava itens, pagamento, entrega e aviso atomicamente', async () => {
    const user = await customer();
    const result = await order(user, { ...orderBody(user.address.id), subtotal: 0, total: 0, desconto: 100, itens: [{ pizza_id: 1, quantidade: 2, preco_unitario: 0.01, observacao: 'Sem cebola' }] });
    assert.equal(result.status, 201, JSON.stringify(result.data));
    assert.equal(result.data.subtotal, 90); assert.equal(result.data.taxa_entrega, 5); assert.equal(result.data.total, 95); assert.equal(result.data.desconto, 0);
    assert.equal(result.data.itens[0].observacao, 'Sem cebola');
    assert.equal(result.data.pagamentos[0].status, 'pendente'); assert.equal(result.data.pagamentos[0].valor, 95);
    assert.equal(result.data.entregas.length, 1);
    assert.equal((await request('/notificacoes', { cookie: user.cookie })).data.length, 1);
    assert.equal((await request('/pedidos', { cookie: user.cookie })).data.length, 1);
});

test('envio repetido com a mesma chave retorna o pedido existente sem duplicar registros', async () => {
    const user = await customer(), key = randomUUID();
    const first = await order(user, orderBody(user.address.id), key);
    const retry = await order(user, orderBody(user.address.id), key);
    assert.equal(first.status, 201); assert.equal(retry.status, 200); assert.equal(first.data.id, retry.data.id);
    for (const table of ['pedidos','pagamentos','entregas','notificacoes']) assert.equal(db.prepare(`SELECT count(*) AS n FROM ${table}`).get().n, 1);
});

test('adicionais e bordas pertencem à pizza; histórico preserva nomes, valores e endereço', async () => {
    const user = await customer();
    db.exec("INSERT INTO bordas(pizza_id,nome,preco) VALUES (1,'Catupiry',8); INSERT INTO adicionais(pizza_id,nome,preco) VALUES (1,'Queijo',4);");
    const body = { ...orderBody(user.address.id), itens: [{ pizza_id: 1, quantidade: 2, borda_id: 1, adicionais_ids: [1] }] };
    const result = await order(user, body); assert.equal(result.status, 201); assert.equal(result.data.total, 119);
    db.exec("UPDATE bordas SET nome='Alterada',preco=99; UPDATE pizzas SET nome='Alterada',preco=99; UPDATE enderecos SET rua='Outra rua';");
    const saved = (await request(`/pedidos/${result.data.id}`, { cookie: user.cookie })).data;
    assert.equal(saved.itens[0].nome, 'Pizza Margherita'); assert.equal(saved.itens[0].preco_unitario, 57);
    assert.equal(saved.itens[0].opcoes.borda.nome, 'Catupiry'); assert.equal(saved.endereco.rua, 'Rua de Teste');
    assert.equal((await order(user, { ...body, itens: [{ pizza_id: 2, quantidade: 1, borda_id: 1 }] })).status, 409);
    assert.equal((await order(user, { ...body, itens: [{ pizza_id: 1, quantidade: 1, adicionais_ids: [1,1] }] })).status, 400);
});

test('um cliente não acessa pedidos, endereços ou notificações de outro', async () => {
    const a = await customer('a@example.test'), b = await customer('b@example.test');
    const saved = await order(a);
    assert.equal((await request(`/pedidos/${saved.data.id}`, { cookie: b.cookie })).status, 404);
    assert.deepEqual((await request('/pedidos', { cookie: b.cookie })).data, []);
    assert.equal((await order(b, orderBody(a.address.id))).status, 400);
    assert.equal((await request('/enderecos', { cookie: b.cookie })).data.length, 1);
    const note = (await request('/notificacoes', { cookie: a.cookie })).data[0];
    assert.equal((await request(`/notificacoes/${note.id}`, { method: 'PATCH', cookie: b.cookie, body: {} })).status, 404);
    assert.equal((await request(`/notificacoes/${note.id}`, { method: 'PATCH', cookie: a.cookie, body: {} })).status, 200);
    assert.equal((await request('/notificacoes', { cookie: a.cookie })).data[0].status, 'lida');
    assert.equal((await request('/pedidos')).status, 401);
});

test('checkout rejeita quantidades inválidas, indisponibilidade e preço alterado', async () => {
    const user = await customer();
    for (const quantidade of [0,-1,1.5,21,'1']) assert.equal((await order(user, { ...orderBody(user.address.id), itens: [{ pizza_id: 1, quantidade }] })).status, 400);
    assert.equal((await order(user, { ...orderBody(user.address.id), itens: [] })).status, 400);
    assert.equal((await order(user, { ...orderBody(user.address.id), total_esperado_centavos: 10 })).status, 409);
    assert.equal((await order(user, { ...orderBody(user.address.id), forma_pagamento: 'pix' })).status, 400);
    db.exec('UPDATE pizzas SET disponivel=0 WHERE id=1');
    assert.equal((await order(user)).status, 409);
    assert.equal(db.prepare('SELECT count(*) AS n FROM pedidos').get().n, 0);
});

test('falha após inserir pedido desfaz todos os registros relacionados', async () => {
    const user = await customer();
    db.exec("CREATE TRIGGER falha_teste BEFORE INSERT ON pagamentos BEGIN SELECT RAISE(ABORT, 'falha de teste'); END;");
    const savedLog = console.error; console.error = () => {};
    try { assert.equal((await order(user)).status, 500); } finally { console.error = savedLog; }
    for (const table of ['pedidos','itens_pedido','pagamentos','entregas','notificacoes']) assert.equal(db.prepare(`SELECT count(*) AS n FROM ${table}`).get().n, 0);
});

test('mutações exigem JSON e bloqueiam origem externa', async () => {
    assert.equal((await request('/auth/login', { method: 'POST', body: [], })).status, 400);
    assert.equal((await request('/auth/logout', { method: 'POST', body: {}, headers: { Origin: 'https://outro.example' } })).status, 403);
    const response = await fetch(base + '/api/auth/logout', { method: 'POST', body: 'foo=bar' }); assert.equal(response.status, 415);
    assert.equal((await request('/auth/login', { method: 'POST', body: {} })).status, 400);
});

test('arquivo SQLite conserva dados e migração pode executar novamente', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'guerra-pizzas-test-'));
    const filename = path.join(directory, 'test.sqlite');
    let disk;
    try {
        disk = new DatabaseSync(filename);
        disk.exec(readFileSync(path.join(__dirname, '../database/schema.sql'), 'utf8'));
        disk.prepare('INSERT INTO categorias(nome) VALUES (?)').run('Persistente'); disk.close(); disk = null;
        disk = openDatabase(filename);
        assert.equal(disk.prepare('SELECT nome FROM categorias').get().nome, 'Persistente');
        assert.ok(disk.prepare('PRAGMA table_info(pedidos)').all().some(c => c.name === 'chave_checkout'));
        disk.close(); disk = openDatabase(filename);
        assert.equal(disk.prepare('SELECT count(*) AS n FROM categorias').get().n, 1);
        assert.deepEqual(disk.prepare('PRAGMA foreign_key_check').all(), []);
        assert.equal(disk.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
    } finally { if (disk) disk.close(); rmSync(directory, { recursive: true, force: true }); }
});
