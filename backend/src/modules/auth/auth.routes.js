const express = require("express");
const authController = require("./auth.controller");

const router = express.Router();

/**
 * Cadastro de usuário
 * POST /auth/register
 */
router.post("/register", authController.register);

/**
 * Login de usuário
 * POST /auth/login
 */
router.post("/login", authController.login);

/**
 * Perfil do usuário autenticado
 * GET /auth/profile
 *
 * Futuramente essa rota receberá
 * o middleware de autenticação JWT.
 */
router.get("/profile", authController.getProfile);

module.exports = router;
