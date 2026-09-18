import test from "node:test";
import assert from "node:assert/strict";

import { listarTodas, buscarPorId } from "../src/modules/menu/menu.service.js";
import { criarPizza } from "../src/modules/menu/menu.controller.js";

function buildRes() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.payload = data;
      return this;
    },
  };
}

test("deve listar as pizzas cadastradas", () => {
  const pizzas = listarTodas();

  assert.ok(Array.isArray(pizzas));
  assert.ok(pizzas.length > 0);
});

test("deve buscar uma pizza pelo id", () => {
  const pizza = buscarPorId(1);

  assert.ok(pizza);
  assert.equal(pizza.nome, "Calabresa");
});

test("deve rejeitar criação de pizza sem nome", () => {
  const before = listarTodas().length;
  const req = { body: { descricao: "Pizza sem nome", preco: 30 } };
  const res = buildRes();

  criarPizza(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(listarTodas().length, before);
  assert.match(res.payload.mensagem, /nome/i);
});
