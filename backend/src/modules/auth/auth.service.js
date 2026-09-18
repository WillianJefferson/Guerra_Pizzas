const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const SALT_ROUNDS = 10;

let userRepository = null;

/**
 * Permite conectar futuramente um repositório de usuários.
 *
 * O repositório deverá fornecer:
 * - findUserByEmail(email)
 * - createUser(userData)
 */
function setUserRepository(repository) {
  userRepository = repository;
}

/**
 * Valida se a senha atende aos requisitos mínimos de segurança.
 *
 * Requisitos:
 * - mínimo de 8 caracteres
 * - 1 letra maiúscula
 * - 1 letra minúscula
 * - 1 número
 * - 1 caractere especial
 */
function validateStrongPassword(password) {
  if (!password || typeof password !== "string") {
    throw new Error("Senha é obrigatória.");
  }

  const passwordRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#._\-])[A-Za-z\d@$!%*?&#._\-]{8,}$/;

  if (!passwordRegex.test(password)) {
    throw new Error(
      "A senha deve possuir no mínimo 8 caracteres, incluindo uma letra maiúscula, uma letra minúscula, um número e um caractere especial.",
    );
  }

  return true;
}

/**
 * Gera o hash seguro da senha.
 */
async function hashPassword(password) {
  validateStrongPassword(password);

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  return hashedPassword;
}

/**
 * Compara a senha digitada com o hash armazenado.
 */
async function comparePassword(password, hashedPassword) {
  if (!password || !hashedPassword) {
    return false;
  }

  return bcrypt.compare(password, hashedPassword);
}

/**
 * Gera um token JWT para um usuário autenticado.
 */
function generateToken(user) {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET não está configurado.");
  }

  if (!user || !user.id) {
    throw new Error("Usuário inválido para geração do token.");
  }

  const payload = {
    id: user.id,
    role: user.role || "cliente",
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });
}

/**
 * Prepara ou cadastra um novo usuário.
 *
 * Sem banco integrado:
 * - valida os dados
 * - gera o hash
 * - retorna os dados seguros
 *
 * Com banco integrado:
 * - verifica email existente
 * - gera o hash
 * - salva o usuário
 * - retorna o usuário criado
 */
async function registerUser({ nome, email, senha, role = "cliente" }) {
  if (!nome || !nome.trim()) {
    throw new Error("Nome é obrigatório.");
  }

  if (!email || !email.trim()) {
    throw new Error("Email é obrigatório.");
  }

  if (!senha) {
    throw new Error("Senha é obrigatória.");
  }

  validateStrongPassword(senha);

  const normalizedEmail = email.trim().toLowerCase();

  /**
   * Validação básica do formato do email.
   */
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(normalizedEmail)) {
    throw new Error("Email inválido.");
  }

  /**
   * Validação de perfil.
   */
  const validRoles = ["cliente", "admin"];

  if (!validRoles.includes(role)) {
    throw new Error("Perfil de usuário inválido.");
  }

  /**
   * Se o banco já estiver integrado,
   * verifica se o email já está cadastrado.
   */
  if (userRepository && typeof userRepository.findUserByEmail === "function") {
    const existingUser = await userRepository.findUserByEmail(normalizedEmail);

    if (existingUser) {
      throw new Error("Usuário já cadastrado.");
    }
  }

  /**
   * Nunca armazenar senha em texto puro.
   */
  const senhaHash = await hashPassword(senha);

  const userData = {
    nome: nome.trim(),
    email: normalizedEmail,
    senhaHash,
    role,
  };

  /**
   * Se o banco já estiver integrado,
   * salva o usuário de verdade.
   */
  if (userRepository && typeof userRepository.createUser === "function") {
    const createdUser = await userRepository.createUser(userData);

    return {
      id: createdUser.id,
      nome: createdUser.nome,
      email: createdUser.email,
      role: createdUser.role,
    };
  }

  /**
   * Enquanto não houver banco,
   * mantém compatibilidade com os testes atuais.
   *
   * Nunca retorna senha ou senhaHash.
   */
  return {
    nome: userData.nome,
    email: userData.email,
    role: userData.role,
  };
}

/**
 * Realiza a lógica de login.
 *
 * Pode receber um usuário diretamente para testes
 * ou buscar pelo email através do userRepository
 * quando o banco estiver integrado.
 */
async function loginUser({ email, senha, user = null }) {
  if (!email || !senha) {
    throw new Error("Email ou senha inválidos");
  }

  const normalizedEmail = email.trim().toLowerCase();

  let authenticatedUser = user;

  /**
   * Se não recebeu um usuário diretamente
   * e existe banco integrado,
   * busca o usuário pelo email.
   */
  if (
    !authenticatedUser &&
    userRepository &&
    typeof userRepository.findUserByEmail === "function"
  ) {
    authenticatedUser = await userRepository.findUserByEmail(normalizedEmail);
  }

  /**
   * Não revela se foi o email
   * ou a senha que estava incorreta.
   */
  if (!authenticatedUser) {
    throw new Error("Email ou senha inválidos");
  }

  if (authenticatedUser.email.trim().toLowerCase() !== normalizedEmail) {
    throw new Error("Email ou senha inválidos");
  }

  const passwordIsValid = await comparePassword(
    senha,
    authenticatedUser.senhaHash,
  );

  if (!passwordIsValid) {
    throw new Error("Email ou senha inválidos");
  }

  const token = generateToken(authenticatedUser);

  return {
    token,

    user: {
      id: authenticatedUser.id,
      nome: authenticatedUser.nome,
      email: authenticatedUser.email,
      role: authenticatedUser.role,
    },
  };
}

module.exports = {
  validateStrongPassword,
  hashPassword,
  comparePassword,
  generateToken,
  registerUser,
  loginUser,
  setUserRepository,
};
