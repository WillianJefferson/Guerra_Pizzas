const authService = require("../src/modules/auth/auth.service");
const authMiddleware = require("../src/modules/auth/auth.middleware");

process.env.JWT_SECRET = "TesteJWT@2026";

async function executarTeste() {
  console.log("\n--- 1. TESTE DE SENHA FORTE ---");

  try {
    authService.validateStrongPassword("Pizza@2026");
    console.log("Senha forte aceita ✅");
  } catch (error) {
    console.log("Erro:", error.message);
  }

  console.log("\n--- 2. TESTE DE SENHA FRACA ---");

  try {
    authService.validateStrongPassword("pizza123");
  } catch (error) {
    console.log("Senha fraca bloqueada ✅");
    console.log(error.message);
  }

  console.log("\n--- 3. CRIANDO HASH DA SENHA ---");

  const senhaHash = await authService.hashPassword("Pizza@2026");

  console.log("Hash criado ✅");
  console.log(senhaHash);

  console.log("\n--- 4. SIMULANDO USUÁRIO SALVO ---");

  const usuario = {
    id: 1,
    nome: "Ially",
    email: "ially@email.com",
    senhaHash,
    role: "cliente",
  };

  console.log({
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    role: usuario.role,
  });

  console.log("\n--- 5. TESTE DE LOGIN ---");

  const login = await authService.loginUser({
    email: "ially@email.com",
    senha: "Pizza@2026",
    user: usuario,
  });

  console.log("Login realizado ✅");

  console.log("Usuário:");
  console.log(login.user);

  console.log("JWT:");
  console.log(login.token);

  console.log("\n--- 6. TESTE DO JWT NO MIDDLEWARE ---");

  const req = {
    headers: {
      authorization: `Bearer ${login.token}`,
    },
  };

  const res = {
    status(code) {
      this.statusCode = code;
      return this;
    },

    json(data) {
      console.log("Erro:", this.statusCode, data);
      return this;
    },
  };

  const next = () => {
    console.log("JWT válido ✅");
    console.log("req.user:", req.user);
  };

  authMiddleware.authenticateToken(req, res, next);
}

executarTeste();
