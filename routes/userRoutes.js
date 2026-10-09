const express = require("express");
const { getUsers } = require("../controllers/userController");
const authenticateUser = require("./authMiddleware");

const router = express.Router();

router.get("/", authenticateUser, getUsers);

module.exports = router;