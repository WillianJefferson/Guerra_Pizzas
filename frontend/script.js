let cart = [];

function addToCart(id, name, price) {
    const existingItem = cart.find(item => item.id === id);
    if (existingItem) {
        existingItem.quantity++;
    } else {
        cart.push({ id, name, price, quantity: 1 });
    }
    updateCartUI();
}

function removeFromCart(id) {
    cart = cart.filter(item => item.id !== id);
    updateCartUI();
}

function updateCartUI() {
    const cartItemsList = document.getElementById('cart-items');
    const cartBadge = document.getElementById('cart-badge');
    const cartTotal = document.getElementById('cart-total');

    cartItemsList.innerHTML = '';

    if (cart.length === 0) {
        cartItemsList.innerHTML = '<li class="list-group-item text-center text-muted">Seu carrinho está vazio.</li>';
        cartBadge.innerText = '0';
        cartTotal.innerText = 'R$ 0,00';
        return;
    }

    let total = 0;
    let totalItems = 0;

    cart.forEach(item => {
        total += item.price * item.quantity;
        totalItems += item.quantity;

        const li = document.createElement('li');
        li.className = 'list-group-item d-flex justify-content-between align-items-center';
        li.innerHTML = `
                    <div>
                        <h6 class="my-0">${item.name}</h6>
                        <small class="text-muted">Qtd: ${item.quantity} x R$ ${item.price.toFixed(2).replace('.', ',')}</small>
                    </div>
                    <button class="btn btn-sm btn-outline-danger" onclick="removeFromCart(${item.id})"><i class="fa-solid fa-trash"></i></button>
                `;
        cartItemsList.appendChild(li);
    });

    cartBadge.innerText = totalItems;
    cartTotal.innerText = `R$ ${total.toFixed(2).replace('.', ',')}`;
}

function checkout() {
    if (cart.length === 0) {
        alert('Seu carrinho está vazio!');
        return;
    }
    alert('Pedido realizado com sucesso! Obrigado pela preferência.');
    cart = [];
    updateCartUI();
    const offcanvasEl = document.getElementById('cartOffcanvas');
    const offcanvas = bootstrap.Offcanvas.getInstance(offcanvasEl);
    offcanvas.hide();
}