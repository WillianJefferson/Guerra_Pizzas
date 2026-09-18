const authService = require("./auth.service");

/**
 * Cadastro de usuário
 */
async function register(req, res) {
  try {
    const { nome, email, senha, role = "cliente" } = req.body;

    if (!nome || !email || !senha) {
      return res.status(400).json({
        message: "Nome, email e senha são obrigatórios.",
      });
    }

    const user = await authService.registerUser({
      nome,
      email,
      senha,
      role,
    });

    return res.status(201).json({
      message: "Usuário cadastrado com sucesso.",
      user,
    });
  } catch (error) {
    return res.status(400).json({
      message: error.message,
    });
  }
}

/**
 * Login de usuário
 */
async function login(req, res) {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({
        message: "Email e senha são obrigatórios.",
      });
    }

    /*
     * TODO:
     * Quando o banco de dados estiver integrado,
     * buscar o usuário pelo email aqui.
     *
     * Exemplo futuro:
     *
     * const user = await userRepository.findByEmail(email);
     */

    const user = null;

    if (!user) {
      return res.status(401).json({
        message: "Email ou senha inválidos",
      });
    }

    const result = await authService.loginUser({
      email,
      senha,
      user,
    });

    return res.status(200).json({
      message: "Login realizado com sucesso.",
      token: result.token,
      user: result.user,
    });
  } catch (error) {
    if (error.message === "Email ou senha inválidos") {
      return res.status(401).json({
        message: "Email ou senha inválidos",
      });
    }

    return res.status(500).json({
      message: "Erro interno do servidor.",
    });
  }
}

/**
 * Perfil do usuário autenticado
 */
async function getProfile(req, res) {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Usuário não autenticado.",
      });
    }

    /*
     * TODO:
     * Quando o banco estiver integrado,
     * buscar os dados completos do usuário
     * usando req.user.id.
     *
     * Nunca retornar senha ou senhaHash.
     */

    return res.status(200).json({
      message: "Perfil do usuário.",
      user: {
        id: req.user.id,
        role: req.user.role,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: "Erro interno do servidor.",
    });
  }
}

module.exports = {
  register,
  login,
  getProfile,
};
