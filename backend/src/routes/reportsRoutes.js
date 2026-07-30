const express = require("express");
const router = express.Router();
const reportsController = require("../controllers/reportsController");
const auth = require("../middlewares/authMiddleware");

router.get("/:tipo", auth, reportsController.gerarRelatorio);

module.exports = router;