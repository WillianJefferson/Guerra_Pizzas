const express = require('express');
const path = require('node:path');
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const { openDatabase, transaction } = require('./database');
const { seedCatalog } = require('./database/seed');
const scrypt = promisify(crypto.scrypt);
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const UFS = new Set('AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' '));
const methods = ['dinheiro', 'cartao'];
const publicUser = u => ({ id: u.id, nome: u.nome, email: u.email });
function fail(status, message) { const error = new Error(message); error.status = status; throw error; }
function text(value, name, max, min = 1) {
    if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) fail(400, `${name}: preencha entre ${min} e ${max} caracteres.`);
    return value.trim();
}
function integer(value, name, max = Number.MAX_SAFE_INTEGER) {
    if (!Number.isSafeInteger(value) || value < 1 || value > max) fail(400, `${name} inválido.`);
    return value;
}
function cents(value) {
    const result = Math.round(Number(value) * 100);
    if (!Number.isSafeInteger(result) || result < 0) fail(409, 'Preço inválido no catálogo.');
    return result;
}
function password(value) {
    if (typeof value !== 'string' || value.length < 8 || value.length > 128) fail(400, 'A senha deve ter entre 8 e 128 caracteres.');
    return value;
}
function email(value) {
    value = text(value, 'E-mail', 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) fail(400, 'Informe um e-mail válido.');
    return value;
}
async function hashPassword(value) {
    const salt = crypto.randomBytes(16).toString('hex');
    const key = await scrypt(value, salt, 64);
    return `scrypt$${salt}$${key.toString('hex')}`;
}
async function verifyPassword(value, hash) {
    if (!hash.startsWith('scrypt$')) return false;
    const [, salt, stored] = hash.split('$');
    const key = await scrypt(value, salt, 64);
    const expected = Buffer.from(stored || '', 'hex');
    return expected.length === key.length && crypto.timingSafeEqual(key, expected);
}

function createApp({ db = openDatabase(), deliveryCents = Number(process.env.TAXA_ENTREGA_CENTAVOS || 0), seed = true, secureCookies = process.env.NODE_ENV === 'production' } = {}) {
    if (!Number.isSafeInteger(deliveryCents) || deliveryCents < 0 || deliveryCents > 100000) throw new Error('TAXA_ENTREGA_CENTAVOS inválida.');
    if (seed) seedCatalog(db);
    const app = express();
    app.disable('x-powered-by');
    app.locals.db = db;
    app.use((req, res, next) => {
        res.set('X-Content-Type-Options', 'nosniff');
        res.set('Referrer-Policy', 'same-origin');
        res.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; font-src 'self' https://cdnjs.cloudflare.com; img-src 'self' https://images.unsplash.com data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
        next();
    });
    app.use('/api', (req, res, next) => {
        res.set('Cache-Control', 'no-store');
        if (!['GET', 'HEAD'].includes(req.method)) {
            if (!req.is('application/json')) return next(Object.assign(new Error('Envie dados JSON.'), { status: 415 }));
            if (req.get('origin') && req.get('origin') !== `${req.protocol}://${req.get('host')}`) return next(Object.assign(new Error('Origem não permitida.'), { status: 403 }));
        }
        next();
    });
    app.use(express.json({ limit: '32kb' }));
    app.use('/api', (req, res, next) => {
        if (!['GET', 'HEAD'].includes(req.method) && (!req.body || typeof req.body !== 'object' || Array.isArray(req.body))) return res.status(400).json({ error: 'Envie um objeto JSON.' });
        next();
    });
    const attempts = new Map();
    function authLimit(req, res, next) {
        const now = Date.now();
        for (const [key, entry] of attempts) if (entry.until < now) attempts.delete(key);
        const key = req.ip;
        const entry = attempts.get(key) || { count: 0, until: now + 15 * 60 * 1000 };
        entry.count++;
        attempts.set(key, entry);
        if (entry.count > 30) { res.set('Retry-After', String(Math.ceil((entry.until - now) / 1000))); return res.status(429).json({ error: 'Muitas tentativas. Tente novamente em alguns minutos.' }); }
        next();
    }
    function sessionToken(req) {
        return (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith('gp_session='))?.slice(11) || '';
    }
    const tokenHash = token => crypto.createHash('sha256').update(token).digest('hex');
    const cookieOptions = { httpOnly: true, sameSite: 'strict', secure: secureCookies, path: '/' };
    function createSession(res, user) {
        const token = crypto.randomBytes(32).toString('hex');
        db.prepare('DELETE FROM sessoes WHERE expira_em <= ?').run(Date.now());
        db.prepare('INSERT INTO sessoes(token_hash,usuario_id,expira_em) VALUES (?,?,?)').run(tokenHash(token), user.id, Date.now() + SESSION_MS);
        res.cookie('gp_session', token, { ...cookieOptions, maxAge: SESSION_MS });
    }
    function authenticated(req, res, next) {
        const token = sessionToken(req);
        const user = token && db.prepare(`SELECT u.* FROM usuarios u JOIN sessoes s ON s.usuario_id=u.id WHERE s.token_hash=? AND s.expira_em>? AND u.ativo=1`).get(tokenHash(token), Date.now());
        if (!user) return res.status(401).json({ error: 'Entre na sua conta para continuar.' });
        req.user = user;
        next();
    }
    app.get('/api/config', (req, res) => res.json({ taxa_entrega: deliveryCents / 100, formas_pagamento: methods }));
    app.get('/api/cardapio', (req, res) => {
        const pizzas = db.prepare(`SELECT p.*, c.nome AS categoria FROM pizzas p JOIN categorias c ON c.id=p.categoria_id WHERE p.disponivel=1 AND c.ativo=1 ORDER BY p.id`).all();
        res.json(pizzas.map(p => ({ ...p,
            adicionais: db.prepare('SELECT id,nome,preco FROM adicionais WHERE pizza_id=? AND disponivel=1 ORDER BY id').all(p.id),
            bordas: db.prepare('SELECT id,nome,preco FROM bordas WHERE pizza_id=? AND disponivel=1 ORDER BY id').all(p.id)
        })));
    });
    app.post('/api/auth/cadastro', authLimit, async (req, res) => {
        const nome = text(req.body.nome, 'Nome', 150, 2);
        const mail = email(req.body.email);
        const senha = password(req.body.senha);
        if (db.prepare('SELECT id FROM usuarios WHERE email=?').get(mail)) fail(409, 'Este e-mail já está cadastrado. Entre na sua conta.');
        const hash = await hashPassword(senha);
        let id;
        try { id = Number(db.prepare('INSERT INTO usuarios(nome,email,senha_hash) VALUES (?,?,?)').run(nome, mail, hash).lastInsertRowid); }
        catch (error) { if (db.prepare('SELECT id FROM usuarios WHERE email=?').get(mail)) fail(409, 'Este e-mail já está cadastrado.'); throw error; }
        const user = db.prepare('SELECT * FROM usuarios WHERE id=?').get(id);
        createSession(res, user);
        res.status(201).json(publicUser(user));
    });
    app.post('/api/auth/login', authLimit, async (req, res) => {
        const mail = email(req.body.email);
        const senha = password(req.body.senha);
        const user = db.prepare('SELECT * FROM usuarios WHERE email=? AND ativo=1').get(mail);
        // Executa a derivação também para usuários inexistentes.
        const valid = await verifyPassword(senha, user?.senha_hash || `scrypt$${'0'.repeat(32)}$${'0'.repeat(128)}`);
        if (!user || !valid) fail(401, 'E-mail ou senha incorretos.');
        createSession(res, user);
        res.json(publicUser(user));
    });
    app.get('/api/auth/me', authenticated, (req, res) => res.json(publicUser(req.user)));
    app.post('/api/auth/logout', (req, res) => {
        db.prepare('DELETE FROM sessoes WHERE token_hash=?').run(tokenHash(sessionToken(req)));
        res.clearCookie('gp_session', cookieOptions);
        res.json({ ok: true });
    });
    app.get('/api/enderecos', authenticated, (req, res) => res.json(db.prepare('SELECT * FROM enderecos WHERE usuario_id=? ORDER BY principal DESC,id DESC').all(req.user.id)));
    app.post('/api/enderecos', authenticated, (req, res) => {
        const b = req.body;
        const rua = text(b.rua, 'Rua', 200), numero = text(b.numero, 'Número', 20);
        const complemento = text(b.complemento || '', 'Complemento', 150, 0), bairro = text(b.bairro, 'Bairro', 100), cidade = text(b.cidade, 'Cidade', 100);
        const estado = text(b.estado, 'Estado', 2).toUpperCase();
        if (!UFS.has(estado)) fail(400, 'Informe uma UF válida.');
        const cep = text(b.cep, 'CEP', 9).replace(/\D/g, '');
        if (!/^\d{8}$/.test(cep)) fail(400, 'Informe um CEP com 8 dígitos.');
        if (b.principal !== undefined && typeof b.principal !== 'boolean') fail(400, 'Endereço principal inválido.');
        const id = transaction(db, () => {
            const principal = b.principal || !db.prepare('SELECT id FROM enderecos WHERE usuario_id=?').get(req.user.id);
            if (principal) db.prepare('UPDATE enderecos SET principal=0 WHERE usuario_id=?').run(req.user.id);
            return Number(db.prepare('INSERT INTO enderecos(usuario_id,rua,numero,complemento,bairro,cidade,estado,cep,principal) VALUES (?,?,?,?,?,?,?,?,?)').run(req.user.id, rua, numero, complemento, bairro, cidade, estado, cep, Number(principal)).lastInsertRowid);
        });
        res.status(201).json(db.prepare('SELECT * FROM enderecos WHERE id=?').get(id));
    });
    function orderDetail(id, userId) {
        const order = db.prepare('SELECT * FROM pedidos WHERE id=? AND usuario_id=?').get(id, userId);
        if (!order) fail(404, 'Pedido não encontrado.');
        const items = db.prepare(`SELECT i.*, COALESCE(i.nome_pizza,p.nome) AS nome FROM itens_pedido i JOIN pizzas p ON p.id=i.pizza_id WHERE i.pedido_id=? ORDER BY i.id`).all(id);
        return { ...order,
            endereco: order.endereco_json ? JSON.parse(order.endereco_json) : db.prepare('SELECT * FROM enderecos WHERE id=?').get(order.endereco_id),
            itens: items.map(i => ({ ...i, opcoes: JSON.parse(i.opcoes_json) })),
            pagamentos: db.prepare('SELECT * FROM pagamentos WHERE pedido_id=? ORDER BY id').all(id),
            entregas: db.prepare(`SELECT e.*, t.nome AS entregador FROM entregas e LEFT JOIN entregadores t ON t.id=e.entregador_id WHERE pedido_id=? ORDER BY e.id`).all(id)
        };
    }
    app.get('/api/pedidos', authenticated, (req, res) => {
        const orders = db.prepare('SELECT id FROM pedidos WHERE usuario_id=? ORDER BY id DESC LIMIT 100').all(req.user.id);
        res.json(orders.map(o => orderDetail(o.id, req.user.id)));
    });
    app.get('/api/pedidos/:id', authenticated, (req, res) => res.json(orderDetail(integer(Number(req.params.id), 'Pedido'), req.user.id)));
    app.post('/api/pedidos', authenticated, (req, res) => {
        const key = text(req.get('Idempotency-Key'), 'Identificador da compra', 100, 16);
        const existing = db.prepare('SELECT id FROM pedidos WHERE usuario_id=? AND chave_checkout=?').get(req.user.id, key);
        if (existing) return res.json(orderDetail(existing.id, req.user.id));
        const b = req.body;
        const addressId = integer(b.endereco_id, 'Endereço');
        if (!methods.includes(b.forma_pagamento)) fail(400, 'Escolha dinheiro ou cartão na entrega.');
        if (!Array.isArray(b.itens) || !b.itens.length || b.itens.length > 50) fail(400, 'O pedido deve conter entre 1 e 50 itens.');
        const orderId = transaction(db, () => {
            const address = db.prepare('SELECT * FROM enderecos WHERE id=? AND usuario_id=?').get(addressId, req.user.id);
            if (!address) fail(400, 'Escolha um endereço da sua conta.');
            let subtotal = 0;
            const items = b.itens.map(item => {
                if (!item || typeof item !== 'object') fail(400, 'Item inválido.');
                const id = integer(item.pizza_id, 'Pizza');
                const quantity = integer(item.quantidade, 'Quantidade', 20);
                const pizza = db.prepare(`SELECT p.* FROM pizzas p JOIN categorias c ON c.id=p.categoria_id WHERE p.id=? AND p.disponivel=1 AND c.ativo=1`).get(id);
                if (!pizza) fail(409, 'Uma pizza não está mais disponível. Atualize o cardápio.');
                let price = cents(pizza.preco);
                let border = null;
                if (item.borda_id != null) {
                    border = db.prepare('SELECT id,nome,preco FROM bordas WHERE id=? AND pizza_id=? AND disponivel=1').get(integer(item.borda_id, 'Borda'), id);
                    if (!border) fail(409, 'Borda indisponível para esta pizza.');
                    price += cents(border.preco);
                }
                const ids = item.adicionais_ids ?? [];
                if (!Array.isArray(ids) || ids.length > 20 || new Set(ids).size !== ids.length) fail(400, 'Adicionais inválidos.');
                const extras = ids.map(extraId => {
                    const extra = db.prepare('SELECT id,nome,preco FROM adicionais WHERE id=? AND pizza_id=? AND disponivel=1').get(integer(extraId, 'Adicional'), id);
                    if (!extra) fail(409, 'Adicional indisponível para esta pizza.');
                    price += cents(extra.preco);
                    return extra;
                });
                subtotal += price * quantity;
                return { pizza, quantity, price, observation: text(item.observacao || '', 'Observação', 500, 0), options: { borda: border, adicionais: extras } };
            });
            const total = subtotal + deliveryCents;
            if (b.total_esperado_centavos !== undefined && b.total_esperado_centavos !== total) fail(409, 'O preço mudou. Confira o total atualizado e confirme novamente.');
            if (!Number.isSafeInteger(total) || total > 100000000) fail(400, 'Valor do pedido excede o limite.');
            const id = Number(db.prepare(`INSERT INTO pedidos(usuario_id,subtotal,taxa_entrega,desconto,total,endereco_id,forma_pagamento,chave_checkout,endereco_json) VALUES (?,?,?,0,?,?,?,?,?)`).run(req.user.id, subtotal / 100, deliveryCents / 100, total / 100, addressId, b.forma_pagamento, key, JSON.stringify(address)).lastInsertRowid);
            const insertItem = db.prepare('INSERT INTO itens_pedido(pedido_id,pizza_id,quantidade,preco_unitario,observacao,nome_pizza,opcoes_json) VALUES (?,?,?,?,?,?,?)');
            for (const item of items) insertItem.run(id, item.pizza.id, item.quantity, item.price / 100, item.observation, item.pizza.nome, JSON.stringify(item.options));
            db.prepare('INSERT INTO pagamentos(pedido_id,metodo,valor) VALUES (?,?,?)').run(id, b.forma_pagamento, total / 100);
            db.prepare('INSERT INTO entregas(pedido_id,codigo_rastreamento) VALUES (?,?)').run(id, crypto.randomUUID());
            db.prepare('INSERT INTO notificacoes(usuario_id,pedido_id,tipo,mensagem) VALUES (?,?,?,?)').run(req.user.id, id, 'pedido', `Pedido #${id} recebido. Aguardando confirmação da pizzaria.`);
            return id;
        });
        res.status(201).json(orderDetail(orderId, req.user.id));
    });
    app.get('/api/notificacoes', authenticated, (req, res) => res.json(db.prepare('SELECT * FROM notificacoes WHERE usuario_id=? ORDER BY id DESC LIMIT 100').all(req.user.id)));
    app.patch('/api/notificacoes/:id', authenticated, (req, res) => {
        const result = db.prepare("UPDATE notificacoes SET status='lida' WHERE id=? AND usuario_id=?").run(integer(Number(req.params.id), 'Notificação'), req.user.id);
        if (!result.changes) fail(404, 'Notificação não encontrada.');
        res.json({ ok: true });
    });
    app.use('/api', (req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));
    app.use(express.static(path.join(__dirname, '..', 'frontend')));
    app.use((err, req, res, next) => {
        if (res.headersSent) return next(err);
        const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
        if (status === 500) console.error(err);
        res.status(status).json({ error: status === 500 ? 'Não foi possível concluir a operação. Tente novamente.' : status === 413 ? 'Dados enviados excedem o limite.' : err.type === 'entity.parse.failed' ? 'JSON inválido.' : err.message });
    });
    return app;
}
module.exports = { createApp };
if (require.main === module) {
    const app = createApp();
    const port = Number(process.env.PORT || 3000);
    const host = process.env.HOST || '127.0.0.1';
    const server = app.listen(port, host, () => console.log(`Guerra de Pizzas disponível em http://${host}:${port}`));
    server.on('error', error => { console.error(error.message); app.locals.db.close(); process.exitCode = 1; });
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close(() => { app.locals.db.close(); process.exit(0); }));
}
