import {
  listarTodas,
  buscarPorId,
  criar,
  atualizar,
  remover,
} from "./menu.service.js";

export function listarPizzas(req, res) {
  const pizzas = listarTodas();

  res.json(pizzas);
}

export function buscarPizzaPorId(req, res) {
  const id = Number(req.params.id);

  const pizza = buscarPorId(id);

  if (!pizza) {
    return res.status(404).json({
      mensagem: "Pizza não encontrada",
    });
  }

  res.json(pizza);
}

export function criarPizza(req, res) {
  const novaPizza = criar(req.body);

  if (novaPizza && novaPizza.erro) {
    return res.status(400).json({
      mensagem: novaPizza.erro,
    });
  }

  res.status(201).json(novaPizza);
}

export function atualizarPizza(req, res) {
  const id = Number(req.params.id);

  const pizzaAtualizada = atualizar(id, req.body);

  if (!pizzaAtualizada) {
    return res.status(404).json({
      mensagem: "Pizza não encontrada",
    });
  }

  if (pizzaAtualizada.erro) {
    return res.status(400).json({
      mensagem: pizzaAtualizada.erro,
    });
  }

  res.json(pizzaAtualizada);
}

export function deletarPizza(req, res) {
  const id = Number(req.params.id);

  const pizzaRemovida = remover(id);

  if (!pizzaRemovida) {
    return res.status(404).json({
      mensagem: "Pizza não encontrada",
    });
  }

  res.json({
    mensagem: "Pizza removida com sucesso",
  });
}

//Regras de negócio ficam no service
// next como parametro