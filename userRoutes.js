const express = require("express");
const { getUsers } = require("./userController");
const authenticateUser = require("./authMiddleware");

const router = express.Router();

router.get("/", authenticateUser, getUsers);

module.exports = router;