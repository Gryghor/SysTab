
const express = require("express");
const router = express.Router();
const upload = require("../config/uploadsConfig");
const usuariosController = require("../controllers/usersController");
const auth = require("../middlewares/authMiddleware");
const admin = require("../middlewares/adminMiddleware");
// Termo de Responsabilidade (PDF) upload/download/view
router.post("/:idUser/termo/upload", auth, upload.single("termo"), usuariosController.uploadTermo);
router.get("/:idUser/termo/download", auth, usuariosController.downloadTermo);
router.get("/:idUser/termo/view", auth, usuariosController.viewTermo);
router.delete("/:idUser/termo", auth, admin, usuariosController.deleteTermo);

router.post("/", auth, usuariosController.criarUsuario);
router.get("/", auth, usuariosController.listarUsuarios);
router.put("/:id", auth, usuariosController.editarUsuario);
router.delete("/:id", auth, admin, usuariosController.deletarUsuario);

console.log('Usuarios routes loaded!');

module.exports = router;
