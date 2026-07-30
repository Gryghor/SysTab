const express = require("express");
const accessAccountsController = require("../controllers/accessAccountsController");
const auth = require("../middlewares/authMiddleware");
const admin = require("../middlewares/adminMiddleware");

const router = express.Router();

router.use(auth, admin);
router.get("/", accessAccountsController.listarContas);
router.post("/", accessAccountsController.criarConta);
router.put("/:id", accessAccountsController.editarConta);
router.get("/:id/senha-provisoria", accessAccountsController.mostrarSenhaProvisoria);
router.patch("/:id/status", accessAccountsController.alterarStatus);
router.patch("/:id/senha", accessAccountsController.resetarSenha);

module.exports = router;
