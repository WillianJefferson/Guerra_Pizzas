let cart = [];

const fallbackPizzas = [
  {
    id: 1,
    nome: "Pizza Margherita",
    descricao:
      "Molho de tomate artesanal, muçarela de búfala, manjericão fresco e azeite.",
    preco: 45,
    imagem:
      "https://images.unsplash.com/photo-1604382355076-af4b0eb60143?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: 2,
    nome: "Pizza",
    descricao:
      "Molho de tomate, muçarela, fatias de calabresa selecionada e cebolas roxas.",
    preco: 408,
    imagem:
      "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: 3,
    nome: "Pizza Quatro Queijos",
    descricao: "Molho de tomate, muçarela, provolone, parmesão e gorgonzola.",
    preco: 55,
    imagem:
      "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=600&q=80",
  },
];

function renderMenuItems(pizzas) {
  const menuContainer = document.getElementById("menu-items");

  if (!menuContainer) {
    return;
  }

  const items = pizzas && pizzas.length ? pizzas : fallbackPizzas;

  menuContainer.innerHTML = items
    .map(
      (pizza) => `
        <div class="col-md-4">
            <div class="card h-100 shadow-sm">
                <img src="${pizza.imagem || "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80"}" class="card-img-top" alt="${pizza.nome}">
                <div class="card-body d-flex flex-column">
                    <h5 class="card-title fw-bold">${pizza.nome}</h5>
                    <p class="card-text text-muted small">${pizza.descricao || "Pizza artesanal preparada com os melhores ingredientes."}</p>
                    <div class="mt-auto d-flex justify-content-between align-items-center">
                        <span class="fs-5 fw-bold text-success">R$ ${Number(pizza.preco).toFixed(2).replace(".", ",")}</span>
                        <button class="btn btn-outline-dark btn-sm" data-id="${pizza.id}" data-name="${pizza.nome}" data-price="${pizza.preco}">Adicionar</button>
                    </div>
                </div>
            </div>
        </div>
    `,
    )
    .join("");

  menuContainer.querySelectorAll("[data-id]").forEach((button) => {
    button.addEventListener("click", () => {
      addToCart(
        Number(button.dataset.id),
        button.dataset.name,
        Number(button.dataset.price),
      );
    });
  });
}

async function loadMenu() {
  try {
    const response = await fetch("http://localhost:3000/api/pizzas");

    if (!response.ok) {
      throw new Error(`Erro ao buscar menu: ${response.status}`);
    }

    const pizzas = await response.json();
    renderMenuItems(pizzas);
  } catch (error) {
    console.error(error);
    renderMenuItems(fallbackPizzas);
  }
}

function addToCart(id, name, price) {
  const existingItem = cart.find((item) => item.id === id);
  if (existingItem) {
    existingItem.quantity++;
  } else {
    cart.push({ id, name, price, quantity: 1 });
  }
  updateCartUI();
}

function removeFromCart(id) {
  cart = cart.filter((item) => item.id !== id);
  updateCartUI();
}

function updateCartUI() {
  const cartItemsList = document.getElementById("cart-items");
  const cartBadge = document.getElementById("cart-badge");
  const cartTotal = document.getElementById("cart-total");

  cartItemsList.innerHTML = "";

  if (cart.length === 0) {
    cartItemsList.innerHTML =
      '<li class="list-group-item text-center text-muted">Seu carrinho está vazio.</li>';
    cartBadge.innerText = "0";
    cartTotal.innerText = "R$ 0,00";
    return;
  }

  let total = 0;
  let totalItems = 0;

  cart.forEach((item) => {
    total += item.price * item.quantity;
    totalItems += item.quantity;

    const li = document.createElement("li");
    li.className =
      "list-group-item d-flex justify-content-between align-items-center";
    li.innerHTML = `
                    <div>
                        <h6 class="my-0">${item.name}</h6>
                        <small class="text-muted">Qtd: ${item.quantity} x R$ ${item.price.toFixed(2).replace(".", ",")}</small>
                    </div>
                    <button class="btn btn-sm btn-outline-danger" onclick="removeFromCart(${item.id})"><i class="fa-solid fa-trash"></i></button>
                `;
    cartItemsList.appendChild(li);
  });

  cartBadge.innerText = totalItems;
  cartTotal.innerText = `R$ ${total.toFixed(2).replace(".", ",")}`;
}

function checkout() {
  if (cart.length === 0) {
    alert("Seu carrinho está vazio!");
    return;
  }
  alert("Pedido realizado com sucesso! Obrigado pela preferência.");
  cart = [];
  updateCartUI();
  const offcanvasEl = document.getElementById("cartOffcanvas");
  const offcanvas = bootstrap.Offcanvas.getInstance(offcanvasEl);
  offcanvas.hide();
}

document.addEventListener("DOMContentLoaded", loadMenu);
