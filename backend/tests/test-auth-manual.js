const readline = require("readline");
const authService = require("../src/modules/auth/auth.service");

process.env.JWT_SECRET = "TesteJWT@2026";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function iniciarTeste() {
  console.log("\n=== TESTE MANUAL DE AUTENTICAÇÃO ===\n");

  const senhaHash = await authService.hashPassword("Pizza@2026");

  const usuarioFake = {
    id: 1,
    nome: "Ially",
    email: "ially@email.com",
    senhaHash,
    role: "cliente",
  };

  rl.question("Digite o email: ", (email) => {
    rl.question("Digite a senha: ", async (senha) => {
      try {
        const resultado = await authService.loginUser({
          email,
          senha,
          user: usuarioFake,
        });

        console.log("\n✅ LOGIN REALIZADO COM SUCESSO");

        console.log("\nUsuário:");
        console.log(resultado.user);

        console.log("\nJWT:");
        console.log(resultado.token);
      } catch (error) {
        console.log("\n❌ LOGIN NEGADO");
        console.log(error.message);
      }

      rl.close();
    });
  });
}

iniciarTeste();
