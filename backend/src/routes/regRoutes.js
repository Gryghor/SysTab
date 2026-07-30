const express = require("express");
const router = express.Router();
const regionaisController = require("../controllers/regionaisController");
const auth = require("../middlewares/authMiddleware");
const admin = require("../middlewares/adminMiddleware");

router.post("/", auth, admin, regionaisController.criarRegional);
router.get("/", auth, regionaisController.listarRegionais);
router.put("/:id", auth, admin, regionaisController.editarRegional);
router.delete("/:id", auth, admin, regionaisController.deletarRegional);

console.log("Regionais Routes Loaded");

module.exports = router;
