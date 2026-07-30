const express = require("express");
const rateLimit = require("express-rate-limit");
const authController = require("../controllers/authController");
const auth = require("../middlewares/authMiddleware");
const router = express.Router();

const loginLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 5,
    message: { error: "Muitas tentativas de login. Tente novamente mais tarde." },
});

router.post("/login", loginLimiter, authController.login);
router.patch("/primeiro-acesso/senha", auth, authController.alterarSenhaPrimeiroAcesso);

console.log("Auth Routes Loaded");

module.exports = router;
