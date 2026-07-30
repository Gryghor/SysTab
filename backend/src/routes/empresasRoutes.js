const express = require("express");
const router = express.Router();
const empresasController = require("../controllers/empresasController");
const auth = require("../middlewares/authMiddleware");
const admin = require("../middlewares/adminMiddleware");

router.post("/", auth, admin, empresasController.criarEmpresa);
router.get("/", auth, empresasController.listarEmpresas);
router.delete("/:id", auth, admin, empresasController.deletarEmpresa);

console.log("Empresas Routes Loaded");

module.exports = router;
