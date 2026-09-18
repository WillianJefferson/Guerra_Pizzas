const authService = require("../src/modules/auth/auth.service");

async function runTests() {
  try {
    console.log("--- TESTE 1: senha válida ---");
    console.log(authService.validateStrongPassword("Pizza@2026"));

    console.log("\n--- TESTE 2: senha inválida ---");

    try {
      authService.validateStrongPassword("pizza123");
    } catch (error) {
      console.log(error.message);
    }

    console.log("\n--- TESTE 3: gerar hash ---");

    const hash = await authService.hashPassword("Pizza@2026");

    console.log("Hash gerado:");
    console.log(hash);

    console.log("\n--- TESTE 4: comparar senha correta ---");

    const senhaCorreta = await authService.comparePassword("Pizza@2026", hash);

    console.log("Resultado:", senhaCorreta);

    console.log("\n--- TESTE 5: comparar senha errada ---");

    const senhaErrada = await authService.comparePassword(
      "Senha@Errada2026",
      hash,
    );

    console.log("\n--- TESTE 6: gerar JWT ---");

    const usuarioTeste = {
      id: 1,
      nome: "Ially",
      email: "ially@email.com",
      role: "cliente",
    };

    console.log("\n--- TESTE 7: registerUser ---");

    const novoUsuario = await authService.registerUser({
      nome: "Ially",
      email: "IALLY@EMAIL.COM",
      senha: "Pizza@2026",
      role: "cliente",
    });

    console.log("\n--- TESTE 8: loginUser ---");

    const senhaHash = await authService.hashPassword("Pizza@2026");

    const usuarioBancoFake = {
      id: 1,
      nome: "Ially",
      email: "ially@email.com",
      senhaHash,
      role: "cliente",
    };

    const login = await authService.loginUser({
      email: "ially@email.com",
      senha: "Pizza@2026",
      user: usuarioBancoFake,
    });

    console.log(login);
    console.log(novoUsuario);
    const token = authService.generateToken(usuarioTeste);

    console.log("Token gerado:");
    console.log(token);

    console.log("Resultado:", senhaErrada);
  } catch (error) {
    console.error("Erro no teste:", error.message);
  }
}

runTests();
