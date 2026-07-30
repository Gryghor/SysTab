const express = require("express");
const router = express.Router();
const logsController = require("../controllers/logsController");
const auth = require("../middlewares/authMiddleware");
const adminMiddleware = require("../middlewares/adminMiddleware");

router.get("/", auth, adminMiddleware, logsController.listarLogs);

console.log("Logs Routes Loaded");

module.exports = router;
