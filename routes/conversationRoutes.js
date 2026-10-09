const express = require("express");
const {
  createConversation,
  getConversations,
} = require("./controllers/conversationController");
const authenticateUser = require("./authMiddleware");
const router = express.Router();
router.post("/", authenticateUser, createConversation);
router.get("/", authenticateUser, getConversations);
module.exports = router;
