const express = require("express");
const router = express.Router();
const logsController = require("../controllers/logsController");
const adminMiddleware = require("../middlewares/adminMiddleware");

// Autenticação já é aplicada globalmente em index.js antes deste router.
router.get("/", adminMiddleware, logsController.listarLogs);

console.log("Logs Routes Loaded");

module.exports = router;
