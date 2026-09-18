const jwt = require("jsonwebtoken");
const authMiddleware = require("../src/modules/auth/auth.middleware");

process.env.JWT_SECRET = "TesteJWT@2026";

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

function createNext() {
  return () => {
    console.log("NEXT CHAMADO ✅");
  };
}

console.log("\n--- TESTE 1: sem token ---");

authMiddleware.authenticateToken(
  {
    headers: {},
  },
  createMockResponse(),
  createNext(),
);

console.log("\n--- TESTE 2: token com formato inválido ---");

authMiddleware.authenticateToken(
  {
    headers: {
      authorization: "Token abc123",
    },
  },
  createMockResponse(),
  createNext(),
);

console.log("\n--- TESTE 3: token inválido ---");

authMiddleware.authenticateToken(
  {
    headers: {
      authorization: "Bearer token-invalido",
    },
  },
  createMockResponse(),
  createNext(),
);

console.log("\n--- TESTE 4: token válido ---");

const validToken = jwt.sign(
  {
    id: 1,
    role: "cliente",
  },
  process.env.JWT_SECRET,
  {
    expiresIn: "1h",
  },
);

const reqValido = {
  headers: {
    authorization: `Bearer ${validToken}`,
  },
};

authMiddleware.authenticateToken(reqValido, createMockResponse(), createNext());

console.log("REQ.USER:", reqValido.user);

console.log("\n--- TESTE 5: token expirado ---");

const expiredToken = jwt.sign(
  {
    id: 1,
    role: "cliente",
  },
  process.env.JWT_SECRET,
  {
    expiresIn: "-1s",
  },
);

authMiddleware.authenticateToken(
  {
    headers: {
      authorization: `Bearer ${expiredToken}`,
    },
  },
  createMockResponse(),
  createNext(),
);
