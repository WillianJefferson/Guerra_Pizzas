const authController = require("../src/modules/auth/auth.controller");

function createMockResponse() {
  return {
    statusCode: 200,
    body: null,

    status(code) {
      this.statusCode = code;
      return this;
    },

    json(data) {
      this.body = data;

      console.log("STATUS:", this.statusCode);
      console.log("RESPOSTA:", data);

      return this;
    },
  };
}

async function runTests() {
  console.log("\n--- TESTE 1: register com dados válidos ---");

  await authController.register(
    {
      body: {
        nome: "Ially",
        email: "IALLY@EMAIL.COM",
        senha: "Pizza@2026",
        role: "cliente",
      },
    },
    createMockResponse(),
  );

  console.log("\n--- TESTE 2: register sem senha ---");

  await authController.register(
    {
      body: {
        nome: "Ially",
        email: "ially@email.com",
      },
    },
    createMockResponse(),
  );

  console.log("\n--- TESTE 3: register com senha fraca ---");

  await authController.register(
    {
      body: {
        nome: "Ially",
        email: "ially@email.com",
        senha: "12345678",
      },
    },
    createMockResponse(),
  );

  console.log("\n--- TESTE 4: login sem email ---");

  await authController.login(
    {
      body: {
        senha: "Pizza@2026",
      },
    },
    createMockResponse(),
  );

  console.log("\n--- TESTE 5: login sem banco integrado ---");

  await authController.login(
    {
      body: {
        email: "ially@email.com",
        senha: "Pizza@2026",
      },
    },
    createMockResponse(),
  );

  console.log("\n--- TESTE 6: profile sem usuário autenticado ---");

  await authController.getProfile({}, createMockResponse());

  console.log("\n--- TESTE 7: profile com usuário autenticado ---");

  await authController.getProfile(
    {
      user: {
        id: 1,
        role: "cliente",
      },
    },
    createMockResponse(),
  );
}

runTests();
