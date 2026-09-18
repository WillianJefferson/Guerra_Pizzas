const jwt = require("jsonwebtoken");

/**
 * Middleware responsável por validar o JWT.
 *
 * Espera receber:
 * Authorization: Bearer TOKEN
 */
function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        message: "Token de autenticação não fornecido.",
      });
    }

    const parts = authHeader.split(" ");

    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return res.status(401).json({
        message: "Formato de token inválido.",
      });
    }

    const token = parts[1];

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        message: "Configuração de autenticação indisponível.",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = {
      id: decoded.id,
      role: decoded.role,
    };

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        message: "Token expirado.",
      });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        message: "Token inválido.",
      });
    }

    return res.status(500).json({
      message: "Erro interno de autenticação.",
    });
  }
}

module.exports = {
  authenticateToken,
};
