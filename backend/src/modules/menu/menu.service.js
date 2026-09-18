const pizzas = [
  {
    id: 1,
    nome: "Calabresa com queijo",
    descricao: "Molho de tomate, muçarela, calabresa e cebola roxa.",
    preco: 350,
    disponivel: true,
    imagem:
      "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: 2,
    nome: "Frango",
    descricao: "Molho de tomate, muçarela, frango desfiado e catupiry.",
    preco: 30,
    disponivel: true,
    imagem:
      "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: 3,
    nome: "Margherita",
    descricao: "Molho de tomate artesanal, muçarela de búfala e manjericão.",
    preco: 35,
    disponivel: true,
    imagem:
      "https://images.unsplash.com/photo-1604382355076-af4b0eb60143?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: 4,
    nome: "Mussarela",
    descricao: "Molho de tomate artesanal e muçarela de búfala",
    preco: 35,
    disponivel: true,
    imagem:
      "https://anamariabrogui.com.br/assets/uploads/receitas/fotos/usuario-1932-5a1b7911dfda6e3c351c30de564da267.jpg",
  },
  {
    id: 5,
    nome: "Chocolate com granulado",
    descricao: "Chocolate com granulado.",
    preco: 615,
    disponivel: true,
    imagem:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQIFobCIE6LTXEZBj70D8RWLsQdSsIWlbFsSAKow7ZvD-YvNy_VsUtAFJU&s=10",
  },
  {
    id: 6,
    nome: "Portuguesa",
    descricao:
      "Molho de tomate artesanal, muçarela de búfala, ovos, tomate, azeitonas e rodelas de cebola.",
    preco: 45,
    disponivel: true,
    imagem:
      "https://www.receitasnestle.com.br/sites/default/files/styles/recipe_detail_desktop_new/public/srh_recipes/2eb7ece4ae9a67b773aa138589e2031d.jpg?itok=8rB5qKP-",
  },
  {
    id: 6,
    nome: "Portuguesa",
    descricao:
      "Molho de tomate artesanal, muçarela de búfala, ovos, tomate, azeitonas e rodelas de cebola.",
    preco: 45,
    disponivel: true,
    imagem:
      "https://www.receitasnestle.com.br/sites/default/files/styles/recipe_detail_desktop_new/public/srh_recipes/2eb7ece4ae9a67b773aa138589e2031d.jpg?itok=8rB5qKP-",
  },
];

function validarDadosPizza(dados) {
  const nome = String(dados?.nome ?? "").trim();
  const descricao = String(dados?.descricao ?? "").trim();
  const preco = Number(dados?.preco);

  if (!nome) {
    return { valido: false, mensagem: "O campo nome é obrigatório." };
  }

  if (!descricao) {
    return { valido: false, mensagem: "O campo descrição é obrigatório." };
  }

  if (!Number.isFinite(preco) || preco <= 0) {
    return {
      valido: false,
      mensagem: "O campo preço deve ser um número maior que zero.",
    };
  }

  return {
    valido: true,
    dados: {
      nome,
      descricao,
      preco,
      disponivel: dados?.disponivel ?? true,
      imagem:
        dados?.imagem ??
        "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80",
    },
  };
}

export function listarTodas() {
  return pizzas;
}

export function listarPizzas() {
  return listarTodas();
}

export function buscarPorId(id) {
  return pizzas.find((pizza) => pizza.id === id);
}

export function criar(dados) {
  const resultado = validarDadosPizza(dados);

  if (!resultado.valido) {
    return { erro: resultado.mensagem };
  }

  const novaPizza = {
    id: pizzas.length + 1,
    ...resultado.dados,
  };

  pizzas.push(novaPizza);

  return novaPizza;
}

export function atualizar(id, dados) {
  const pizza = pizzas.find((pizza) => pizza.id === id);

  if (!pizza) {
    return null;
  }

  if (dados && Object.keys(dados).length > 0) {
    const resultado = validarDadosPizza({
      ...pizza,
      ...dados,
    });

    if (!resultado.valido) {
      return { erro: resultado.mensagem };
    }

    pizza.nome = resultado.dados.nome;
    pizza.descricao = resultado.dados.descricao;
    pizza.preco = resultado.dados.preco;
    pizza.disponivel = resultado.dados.disponivel;
    pizza.imagem = resultado.dados.imagem;
  }

  return pizza;
}

export function remover(id) {
  const indice = pizzas.findIndex((pizza) => pizza.id === id);

  if (indice === -1) {
    return null;
  }

  const pizzaRemovida = pizzas.splice(indice, 1);

  return pizzaRemovida[0];
}
