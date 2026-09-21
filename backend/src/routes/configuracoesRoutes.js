const express = require("express");
const configuracoesController = require("../controllers/configuracoesController");
const auth = require("../middlewares/authMiddleware");
const admin = require("../middlewares/adminMiddleware");

const router = express.Router();

router.get("/", auth, configuracoesController.obterConfiguracoes);
router.patch("/cpf-obrigatorio", auth, admin, configuracoesController.atualizarCpfObrigatorio);

module.exports = router;
