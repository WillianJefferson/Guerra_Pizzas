const $ = id => document.getElementById(id);
const money = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const cents = value => Math.round(Number(value) * 100);
const state = { menu: [], config: null, user: null, addresses: [], cart: [], authMode: 'login', afterAuth: null, submitting: false };
const CART_KEY = 'guerra-pizzas-cart-v1';
const CHECKOUT_KEY = 'guerra-pizzas-checkout-v1';
function readStorage(storage, key, fallback) { try { return JSON.parse(storage.getItem(key)) ?? fallback; } catch { return fallback; } }
function writeStorage(storage, key, value) { try { storage.setItem(key, JSON.stringify(value)); } catch { /* O fluxo continua se armazenamento estiver bloqueado. */ } }
const stored = readStorage(localStorage, CART_KEY, []);
if (Array.isArray(stored)) state.cart = stored.slice(0, 50).filter(i => i && Number.isSafeInteger(i.pizza_id) && Number.isInteger(i.quantidade) && i.quantidade > 0 && i.quantidade <= 20 && (i.borda_id == null || Number.isSafeInteger(i.borda_id)) && Array.isArray(i.adicionais_ids) && i.adicionais_ids.every(Number.isSafeInteger) && typeof i.observacao === 'string' && i.observacao.length <= 500);
function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
}
function button(label, className, action) {
    const b = node('button', className, label); b.type = 'button'; b.addEventListener('click', action); return b;
}
function notify(message, error = false) {
    for (const element of document.querySelectorAll('[data-feedback]')) {
        element.textContent = message; element.className = error ? 'error-message' : 'success-message'; element.hidden = !message;
    }
}
function showDialog(id) {
    for (const dialog of document.querySelectorAll('dialog[open]')) dialog.close();
    notify(''); $(id).showModal();
}
async function api(path, { method = 'GET', body, headers = {} } = {}) {
    let response;
    try { response = await fetch(`/api${path}`, { method, credentials: 'same-origin', headers: { ...(method === 'GET' ? {} : { 'Content-Type': 'application/json' }), ...headers }, ...(method === 'GET' ? {} : { body: JSON.stringify(body || {}) }) }); }
    catch { throw new Error('Não foi possível conectar. Verifique sua conexão e tente novamente.'); }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        if (response.status === 401 && path !== '/auth/login') setUser(null);
        const error = new Error(data.error || 'Não foi possível concluir a operação.'); error.status = response.status; throw error;
    }
    return data;
}
function setUser(user) {
    state.user = user;
    $('account-button').textContent = user ? `Olá, ${user.nome.split(' ')[0]}` : 'Entrar / cadastrar';
    $('logout-button').hidden = !user;
    if (!user) {
        state.addresses = []; $('account-section').hidden = true;
        $('orders-list').replaceChildren(); $('notifications').replaceChildren();
        $('address-select').replaceChildren(new Option('Cadastre um endereço', ''));
    }
}
function itemData(item) {
    const pizza = state.menu.find(p => p.id === item.pizza_id);
    if (!pizza) return { name: 'Pizza indisponível', valid: false, unit: 0, descriptions: [] };
    let unit = cents(pizza.preco), valid = true;
    const descriptions = [];
    if (item.borda_id != null) {
        const border = pizza.bordas.find(b => b.id === item.borda_id);
        if (!border) valid = false;
        else { unit += cents(border.preco); descriptions.push(`Borda: ${border.nome}`); }
    }
    for (const id of item.adicionais_ids) {
        const extra = pizza.adicionais.find(a => a.id === id);
        if (!extra) valid = false;
        else { unit += cents(extra.preco); descriptions.push(extra.nome); }
    }
    if (item.observacao) descriptions.push(item.observacao);
    return { name: pizza.nome, valid, unit, descriptions };
}
function cartTotals() {
    const subtotal = state.cart.reduce((sum, i) => sum + itemData(i).unit * i.quantidade, 0);
    const delivery = state.cart.length && state.config ? cents(state.config.taxa_entrega) : 0;
    return { subtotal, delivery, total: subtotal + delivery };
}
function renderCart() {
    const list = $('cart-items'); list.replaceChildren();
    if (!state.cart.length) list.append(node('p', 'text-muted', 'Seu carrinho está vazio. Escolha uma pizza no cardápio.'));
    state.cart.forEach((item, index) => {
        const data = itemData(item), line = node('div', 'cart-line');
        line.append(node('h3', '', data.name));
        if (data.descriptions.length) line.append(node('p', 'small text-muted mb-1', data.descriptions.join(' • ')));
        line.append(node('p', data.valid ? 'mb-1' : 'text-danger', data.valid ? `${money(data.unit / 100)} por unidade` : 'Pizza ou opção indisponível. Remova este item e escolha novamente.'));
        const actions = node('div', 'cart-actions');
        actions.append(button('−', 'btn btn-outline-dark btn-sm', () => { if (item.quantidade > 1) item.quantidade--; else state.cart.splice(index, 1); cartChanged(); }), node('span', '', `${item.quantidade} un.`), button('+', 'btn btn-outline-dark btn-sm', () => { if (item.quantidade >= 20) return notify('Máximo de 20 unidades por item.', true); item.quantidade++; cartChanged(); }), button('Remover', 'btn btn-outline-danger btn-sm', () => { state.cart.splice(index, 1); cartChanged(); }));
        actions.firstChild.setAttribute('aria-label', `Diminuir quantidade de ${data.name}`);
        actions.children[2].setAttribute('aria-label', `Aumentar quantidade de ${data.name}`);
        line.append(actions); list.append(line);
    });
    const totals = cartTotals();
    $('cart-badge').textContent = state.cart.reduce((sum, item) => sum + item.quantidade, 0);
    for (const prefix of ['cart', 'checkout']) {
        $(`${prefix}-subtotal`).textContent = money(totals.subtotal / 100);
        $(`${prefix}-delivery`).textContent = money(totals.delivery / 100);
        $(`${prefix}-total`).textContent = money(totals.total / 100);
    }
    $('checkout-button').disabled = !state.cart.length || !state.config || state.cart.some(i => !itemData(i).valid);
    $('place-order').disabled = $('checkout-button').disabled || !state.addresses.length;
}
function cartChanged() { writeStorage(localStorage, CART_KEY, state.cart); renderCart(); }
function renderMenu() {
    const list = $('menu-items'); list.replaceChildren();
    if (!state.menu.length) { list.append(node('p', '', 'Nenhuma pizza disponível no momento.')); return; }
    state.menu.forEach((pizza, index) => {
        const column = node('div', 'col-md-6 col-lg-4');
        const card = node('article', 'card h-100 shadow-sm pizza-card');
        const image = node('img', 'card-img-top');
        const photos = ['photo-1604382355076-af4b0eb60143', 'photo-1565299624946-b28f40a0ae38', 'photo-1574071318508-1cdbab80d002'];
        image.src = `https://images.unsplash.com/${photos[index % photos.length]}?auto=format&fit=crop&w=600&q=80`; image.alt = ''; image.loading = 'lazy';
        const body = node('div', 'card-body d-flex flex-column');
        body.append(node('p', 'small text-muted mb-1', pizza.categoria), node('h3', 'h5 fw-bold', pizza.nome), node('p', 'text-muted small', pizza.descricao || ''));
        const form = node('form', 'mt-auto');
        const details = node('details', 'pizza-options mb-3'); details.append(node('summary', '', 'Personalizar pizza'));
        const border = node('select', 'form-select mt-2 mb-2'); border.append(new Option('Sem borda recheada', ''));
        for (const option of pizza.bordas) border.append(new Option(`${option.nome} (+${money(option.preco)})`, option.id));
        if (pizza.bordas.length) { const label = node('label', '', 'Borda'); label.append(border); details.append(label); }
        const checks = [];
        for (const extra of pizza.adicionais) {
            const label = node('label', 'small mt-2'), check = node('input'); check.type = 'checkbox'; check.value = extra.id;
            label.append(check, document.createTextNode(`${extra.nome} (+${money(extra.preco)})`)); details.append(label); checks.push(check);
        }
        const observation = node('textarea', 'form-control mt-2'); observation.maxLength = 500; observation.rows = 2; observation.placeholder = 'Ex.: sem cebola';
        const observationLabel = node('label', 'small mt-2', 'Observação'); observationLabel.append(observation); details.append(observationLabel);
        const price = node('span', 'pizza-price', money(pizza.preco));
        form.addEventListener('change', () => {
            let value = cents(pizza.preco);
            if (border.value) value += cents(pizza.bordas.find(b => b.id === Number(border.value)).preco);
            checks.filter(c => c.checked).forEach(c => { value += cents(pizza.adicionais.find(a => a.id === Number(c.value)).preco); });
            price.textContent = money(value / 100);
        });
        const bottom = node('div', 'd-flex justify-content-between align-items-center gap-2');
        const add = node('button', 'btn btn-outline-dark', 'Adicionar'); add.type = 'submit'; bottom.append(price, add);
        form.append(details, bottom);
        form.addEventListener('submit', event => {
            event.preventDefault();
            const item = { pizza_id: pizza.id, borda_id: border.value ? Number(border.value) : null, adicionais_ids: checks.filter(c => c.checked).map(c => Number(c.value)).sort((a,b) => a-b), observacao: observation.value.trim(), quantidade: 1 };
            const same = state.cart.find(i => i.pizza_id === item.pizza_id && i.borda_id === item.borda_id && JSON.stringify(i.adicionais_ids) === JSON.stringify(item.adicionais_ids) && i.observacao === item.observacao);
            if (same?.quantidade >= 20 || (!same && state.cart.length >= 50)) return notify('Limite do carrinho atingido.', true);
            if (same) same.quantidade++; else state.cart.push(item);
            cartChanged(); notify(`${pizza.nome} adicionada ao carrinho.`);
            add.textContent = 'Adicionada ✓'; setTimeout(() => { add.textContent = 'Adicionar'; }, 1200);
        });
        body.append(form); card.append(image, body); column.append(card); list.append(column);
    });
}
async function loadMenu() {
    $('reload-menu').disabled = true;
    try {
        const [menu, config] = await Promise.all([api('/cardapio'), api('/config')]);
        state.menu = menu; state.config = config;
        $('delivery-info').textContent = config.taxa_entrega ? `Taxa de entrega: ${money(config.taxa_entrega)} • Pagamento na entrega` : 'Entrega grátis • Pagamento na entrega';
        renderMenu(); renderCart();
    } catch (error) {
        $('delivery-info').textContent = 'Não foi possível consultar a entrega.';
        if (!state.menu.length) $('menu-items').replaceChildren(node('p', 'text-muted', 'Não foi possível carregar o cardápio. Use “Atualizar cardápio” para tentar novamente.'));
        throw error;
    } finally { $('reload-menu').disabled = false; }
}
function authMode(mode) {
    state.authMode = mode; const register = mode === 'cadastro';
    $('name-field').hidden = !register; $('auth-name').required = register;
    $('auth-title').textContent = register ? 'Criar minha conta' : 'Entrar na sua conta';
    $('auth-submit').textContent = register ? 'Cadastrar e entrar' : 'Entrar';
    $('auth-toggle').textContent = register ? 'Já tenho uma conta' : 'Ainda não tenho conta';
    $('auth-password').autocomplete = register ? 'new-password' : 'current-password';
    notify('');
}
function requireUser(action) {
    if (state.user) return action();
    state.afterAuth = action; authMode('login'); showDialog('auth-dialog');
}
const addressText = a => `${a.rua}, ${a.numero}${a.complemento ? `, ${a.complemento}` : ''} — ${a.bairro}, ${a.cidade}/${a.estado} • CEP ${a.cep}`;
async function loadAddresses(selectedId) {
    state.addresses = await api('/enderecos');
    const select = $('address-select'); select.replaceChildren();
    if (!state.addresses.length) select.append(new Option('Cadastre um endereço acima', ''));
    for (const address of state.addresses) select.append(new Option(`${address.principal ? 'Principal: ' : ''}${addressText(address)}`, address.id));
    if (selectedId) select.value = String(selectedId);
    $('address-details').open = !state.addresses.length;
    renderCart();
}
async function openCheckout() {
    if (!state.cart.length) return notify('Adicione uma pizza para continuar.', true);
    if (!state.user) return requireUser(openCheckout);
    try { await loadAddresses(); showDialog('checkout-dialog'); }
    catch (error) { notify(error.message, true); if (error.status === 401) requireUser(openCheckout); }
}
const statuses = { pendente: 'Aguardando confirmação', confirmado: 'Confirmado', preparando: 'Em preparo', em_preparo: 'Em preparo', saiu_entrega: 'Saiu para entrega', em_entrega: 'Em entrega', entregue: 'Entregue', cancelado: 'Cancelado', pago: 'Pago', aprovado: 'Aprovado', recusado: 'Recusado' };
const statusText = status => statuses[status] || status.replaceAll('_', ' ');
function renderOrders(orders, notifications) {
    const list = $('orders-list'); list.replaceChildren();
    if (!orders.length) list.append(node('p', 'text-muted', 'Você ainda não tem pedidos. Escolha sua primeira pizza!'));
    for (const order of orders) {
        const card = node('article', 'order-card');
        const heading = node('div', 'section-heading'); heading.append(node('h3', '', `Pedido #${order.id}`), node('strong', '', money(order.total)));
        card.append(heading, node('p', '', `${statusText(order.status)} • ${new Date(order.criado_em.replace(' ', 'T') + 'Z').toLocaleString('pt-BR')}`));
        const items = node('ul');
        for (const item of order.itens) {
            const optionNames = [...(item.opcoes.borda ? [`Borda: ${item.opcoes.borda.nome}`] : []), ...(item.opcoes.adicionais || []).map(a => a.nome), ...(item.observacao ? [item.observacao] : [])];
            items.append(node('li', '', `${item.quantidade} × ${item.nome} — ${money(item.preco_unitario * item.quantidade)}${optionNames.length ? ` (${optionNames.join('; ')})` : ''}`));
        }
        card.append(items, node('p', 'small', `Subtotal: ${money(order.subtotal)} • Entrega: ${money(order.taxa_entrega)} • Desconto: ${money(order.desconto)}`));
        if (order.endereco) card.append(node('p', 'small text-muted', addressText(order.endereco)));
        for (const payment of order.pagamentos) card.append(node('p', 'small mb-1', `Pagamento: ${payment.metodo === 'cartao' ? 'cartão' : payment.metodo} na entrega • ${payment.status === 'pendente' ? 'Pendente' : statusText(payment.status)}`));
        for (const delivery of order.entregas) card.append(node('p', 'small mb-1', `Entrega: ${delivery.status === 'pendente' ? 'Aguardando despacho' : statusText(delivery.status)}${delivery.entregador ? ` • ${delivery.entregador}` : ''}`));
        list.append(card);
    }
    const notes = $('notifications'); notes.replaceChildren();
    for (const note of notifications.filter(n => n.status !== 'lida')) {
        const row = node('div', 'notification');
        row.append(node('p', 'small', note.mensagem), button('Marcar como lida', 'btn btn-outline-dark btn-sm', async event => {
            const control = event.currentTarget; control.disabled = true;
            try { await api(`/notificacoes/${note.id}`, { method: 'PATCH' }); row.remove(); }
            catch (error) { control.disabled = false; notify(error.message, true); }
        }));
        notes.append(row);
    }
}
async function loadOrders() {
    if (!state.user) return requireUser(loadOrders);
    $('account-section').hidden = false; $('refresh-orders').disabled = true;
    try {
        const [orders, notes] = await Promise.all([api('/pedidos'), api('/notificacoes')]);
        renderOrders(orders, notes); $('account-section').scrollIntoView({ behavior: 'smooth' });
    } catch (error) { notify(error.message, true); }
    finally { $('refresh-orders').disabled = false; }
}
for (const uf of 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ')) $('state-select').append(new Option(uf, uf));
for (const b of document.querySelectorAll('[data-close]')) b.addEventListener('click', () => { if (!state.submitting) $(b.dataset.close).close(); });
$('checkout-dialog').addEventListener('cancel', event => { if (state.submitting) event.preventDefault(); });
$('cart-button').addEventListener('click', () => { renderCart(); showDialog('cart-dialog'); });
$('checkout-button').addEventListener('click', openCheckout);
$('account-button').addEventListener('click', () => requireUser(loadOrders));
$('orders-button').addEventListener('click', () => requireUser(loadOrders));
$('refresh-orders').addEventListener('click', loadOrders);
$('reload-menu').addEventListener('click', () => loadMenu().catch(e => notify(e.message, true)));
$('auth-toggle').addEventListener('click', () => authMode(state.authMode === 'login' ? 'cadastro' : 'login'));
$('auth-form').addEventListener('submit', async event => {
    event.preventDefault(); const form = event.currentTarget; const fields = form.querySelector('fieldset');
    if (fields.disabled) return;
    const body = Object.fromEntries(new FormData(form)); fields.disabled = true; notify('');
    try {
        const user = await api(`/auth/${state.authMode}`, { method: 'POST', body });
        setUser(user); form.reset(); $('auth-dialog').close();
        const action = state.afterAuth; state.afterAuth = null;
        if (action) await action();
    } catch (error) { notify(error.message, true); }
    finally { fields.disabled = false; }
});
$('logout-button').addEventListener('click', async () => {
    $('logout-button').disabled = true;
    try { await api('/auth/logout', { method: 'POST' }); setUser(null); state.afterAuth = null; notify('Você saiu da conta.'); }
    catch (error) { notify(error.message, true); }
    finally { $('logout-button').disabled = false; }
});
$('address-form').addEventListener('submit', async event => {
    event.preventDefault(); const form = event.currentTarget; const fields = form.querySelector('fieldset');
    if (fields.disabled) return;
    const body = Object.fromEntries(new FormData(form)); body.principal = form.elements.principal.checked; fields.disabled = true;
    try { const address = await api('/enderecos', { method: 'POST', body }); form.reset(); await loadAddresses(address.id); $('address-details').open = false; notify('Endereço salvo.'); }
    catch (error) { notify(error.message, true); }
    finally { fields.disabled = false; }
});
$('checkout-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (state.submitting || !state.cart.length) return;
    const form = event.currentTarget, fields = form.querySelector('fieldset');
    const body = { endereco_id: Number($('address-select').value), forma_pagamento: $('payment-select').value, itens: state.cart, total_esperado_centavos: cartTotals().total };
    const fingerprint = JSON.stringify({ user: state.user?.id, ...body });
    let pending = readStorage(sessionStorage, CHECKOUT_KEY, null);
    if (!pending || pending.fingerprint !== fingerprint) pending = { fingerprint, key: crypto.randomUUID() };
    writeStorage(sessionStorage, CHECKOUT_KEY, pending);
    state.submitting = true; fields.disabled = true; $('place-order').textContent = 'Enviando pedido…'; notify('');
    try {
        const order = await api('/pedidos', { method: 'POST', body, headers: { 'Idempotency-Key': pending.key } });
        state.cart = []; cartChanged(); writeStorage(sessionStorage, CHECKOUT_KEY, null); $('checkout-dialog').close();
        await loadOrders(); notify(`Pedido #${order.id} recebido! Total: ${money(order.total)}. Aguarde a confirmação da pizzaria.`);
    } catch (error) {
        if (error.status === 401) { $('checkout-dialog').close(); requireUser(openCheckout); }
        if (error.status === 409) await loadMenu().catch(() => {});
        notify(error.message, true);
    } finally { state.submitting = false; fields.disabled = false; $('place-order').textContent = 'Confirmar pedido'; }
});
async function init() {
    renderCart();
    const results = await Promise.allSettled([loadMenu(), api('/auth/me').then(setUser)]);
    for (const result of results) if (result.status === 'rejected' && result.reason.status !== 401) notify(result.reason.message, true);
}
init();
