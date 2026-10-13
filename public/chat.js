
let socket = null;
let currentUser = null;
let users = [];
let conversations = [];
let activeConversationId = null;
let activeConversation = null;
let renderedMessageIds = new Set();

function decodeToken(token) {
  try {
    const payload = token.split(".")[1];
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decoded);
  } catch {
    return {};
  }
}

function getId(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return String(value._id || value.id || "");
}

function getItems(result, key) {
  const payload = getPayload(result);

  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.[key])) return payload[key];
  if (Array.isArray(result?.[key])) return result[key];

  return [];
}

function getCurrentUserId() {
  const token = sessionStorage.getItem("accessToken");
  return token ? String(decodeToken(token).userId || "") : "";
}

function getOtherParticipant(conversation) {
  const participants = conversation.participants || [];
  const myId = getCurrentUserId();

  return participants.find((person) => getId(person) !== myId) || null;
}

function getDisplayName(user) {
  return user?.name || user?.username || user?.email || "Unknown user";
}

function getInitial(user) {
  return getDisplayName(user).charAt(0).toUpperCase() || "?";
}

function getConversationId(conversation) {
  return getId(conversation);
}

function formatTime(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function createAvatar(user, elementId) {
  const element = document.getElementById(elementId);
  element.textContent = getInitial(user);
}

function renderCurrentUser() {
  const savedUser = JSON.parse(
    sessionStorage.getItem("currentUser") || "null"
  );

  currentUser = savedUser || {};
  const myId = getCurrentUserId();

  if (!currentUser.name) {
    const found = users.find((user) => getId(user) === myId);
    if (found) currentUser = found;
  }

  document.getElementById("myName").textContent =
    getDisplayName(currentUser);

  document.getElementById("myEmail").textContent =
    currentUser.email || "";

  createAvatar(currentUser, "myAvatar");
}

function renderConversations() {
  const list = document.getElementById("conversationList");
  list.replaceChildren();

  if (!conversations.length) {
    list.innerHTML = '<p class="empty-note">No conversations yet. Search for someone to start one.</p>';
    return;
  }

  conversations.forEach((conversation) => {
    const otherUser = getOtherParticipant(conversation);
    const button = document.createElement("button");
    button.className = "conversation-item";

    if (getConversationId(conversation) === activeConversationId) {
      button.classList.add("active");
    }

    const avatar = document.createElement("span");
    avatar.className = "user-avatar";
    avatar.textContent = getInitial(otherUser);

    const info = document.createElement("span");
    info.className = "conversation-info";

    const name = document.createElement("strong");
    name.textContent = getDisplayName(otherUser);

    const preview = document.createElement("p");
    preview.textContent = conversation.lastMessage?.text || "Open conversation";

    info.append(name, preview);
    button.append(avatar, info);

    button.addEventListener("click", () => {
      openConversation(conversation);
    });

    list.appendChild(button);
  });
}

function renderPeople(results) {
  const container = document.getElementById("peopleResults");
  container.replaceChildren();
  container.hidden = results.length === 0;

  results.forEach((user) => {
    const button = document.createElement("button");
    button.className = "person-item";

    const avatar = document.createElement("span");
    avatar.className = "user-avatar";
    avatar.textContent = getInitial(user);

    const info = document.createElement("span");
    info.className = "conversation-info";

    const name = document.createElement("strong");
    name.textContent = getDisplayName(user);

    const email = document.createElement("p");
    email.textContent = user.email || "";

    info.append(name, email);
    button.append(avatar, info);

    button.addEventListener("click", () => startConversation(user));

    container.appendChild(button);
  });
}

async function loadUsers() {
  const result = await apiRequest("/users");
  users = getItems(result, "users");
  renderCurrentUser();
}

async function loadConversations() {
  const result = await apiRequest("/conversations");
  conversations = getItems(result, "conversations");
  renderConversations();
}

function connectSocket() {
  const token = sessionStorage.getItem("accessToken");

  if (!token || typeof io !== "function") {
    showToast("Unable to connect to real-time messaging.");
    return;
  }

  if (socket) socket.disconnect();

  socket = io({
    auth: { token }
  });

  socket.on("connect", () => {
    conversations.forEach((conversation) => {
      const id = getConversationId(conversation);

      socket.emit("joinConversation", id, (result) => {
        if (!result?.success) {
          console.warn("Could not join conversation:", result?.message);
        }
      });
    });
  });

  socket.on("connect_error", (error) => {
    showToast(error.message || "Real-time connection failed.");
  });

  socket.on("newMessage", (message) => {
    const messageConversationId = getId(message.conversation);

    if (messageConversationId === activeConversationId) {
      appendMessage(message);
    }

    loadConversations().catch(() => {});
  });
}

function disconnectChat() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }

  activeConversationId = null;
  activeConversation = null;
}

async function openConversation(conversation) {
  activeConversation = conversation;
  activeConversationId = getConversationId(conversation);
  renderedMessageIds.clear();

  document.getElementById("emptyChat").hidden = true;
  document.getElementById("conversationView").hidden = false;

  const otherUser = getOtherParticipant(conversation);

  document.getElementById("chatName").textContent =
    getDisplayName(otherUser);

  document.getElementById("chatSubtitle").textContent =
    otherUser?.email || "Your conversation";

  createAvatar(otherUser, "chatAvatar");
  document.getElementById("messageList").replaceChildren();
  renderConversations();

  if (socket?.connected) {
    socket.emit("joinConversation", activeConversationId, (result) => {
      if (!result?.success) showToast(result?.message || "Could not join chat.");
    });
  }

  try {
    const result = await apiRequest(
      `/messages/${encodeURIComponent(activeConversationId)}`
    );

    const messages = getItems(result, "messages");

    messages.forEach(appendMessage);

    const messageList = document.getElementById("messageList");
    messageList.scrollTop = messageList.scrollHeight;
  } catch (error) {
    showToast(error.message);
  }
}

function appendMessage(message) {
  const id = getId(message);

  if (id && renderedMessageIds.has(id)) return;
  if (id) renderedMessageIds.add(id);

  const list = document.getElementById("messageList");
  const myId = getCurrentUserId();
  const senderId = getId(message.sender);
  const mine = senderId === myId;

  const wrapper = document.createElement("div");
  wrapper.className = `message ${mine ? "mine" : "theirs"}`;

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";
  bubble.textContent = message.text || "";

  const time = document.createElement("span");
  time.className = "message-time";
  time.textContent = formatTime(message.createdAt || message.updatedAt);

  wrapper.append(bubble, time);
  list.appendChild(wrapper);
  list.scrollTop = list.scrollHeight;
}

async function startConversation(user) {
  const targetId = getId(user);

  if (!targetId) {
    showToast("This user has no valid ID.");
    return;
  }

  try {
    const existing = conversations.find((conversation) => {
      const participants = conversation.participants || [];

      return participants.some((person) => getId(person) === targetId) &&
        participants.some((person) => getId(person) === getCurrentUserId());
    });

    let conversation = existing;

    if (!conversation) {
      const result = await apiRequest("/conversations", {
        method: "POST",
        body: JSON.stringify({ participantId: targetId })
      });

      const payload = getPayload(result);
      conversation = payload.conversation || payload;

      if (!getConversationId(conversation)) {
        throw new Error("The server did not return a conversation.");
      }

      conversations.unshift(conversation);
    }

    document.getElementById("searchUsers").value = "";
    document.getElementById("peopleResults").hidden = true;

    renderConversations();

    if (socket?.connected) {
      socket.emit("joinConversation", getConversationId(conversation), () => {});
    }

    await openConversation(conversation);
  } catch (error) {
    showToast(error.message);
  }
}

document.getElementById("searchUsers").addEventListener("input", (event) => {
  const query = event.target.value.trim().toLowerCase();
  const myId = getCurrentUserId();

  if (!query) {
    renderPeople([]);
    return;
  }

  const matches = users.filter((user) => {
    const isMe = getId(user) === myId;
    const text = `${user.name || ""} ${user.username || ""} ${user.email || ""}`.toLowerCase();

    return !isMe && text.includes(query);
  });

  renderPeople(matches.slice(0, 10));
});

async function sendMessage(event) {
  event.preventDefault();

  const input = document.getElementById("messageInput");
  const text = input.value.trim();

  if (!text || !activeConversationId) return;

  if (!socket?.connected) {
    showToast("Real-time connection is unavailable. Reconnect and try again.");
    return;
  }

  const button = event.submitter;
  if (button) button.disabled = true;

  socket.emit("sendMessage", {
    conversationId: activeConversationId,
    text
  }, async (result) => {
    if (!result?.success) {
      showToast(result?.message || "Could not send message.");
      if (button) button.disabled = false;
      return;
    }

    input.value = "";

    if (result.data) appendMessage(result.data);

    try {
      await loadConversations();
    } catch {}

    if (button) button.disabled = false;
    input.focus();
  });
}

document.getElementById("messageForm").addEventListener("submit", sendMessage);

document.getElementById("newChat").addEventListener("click", () => {
  document.getElementById("searchUsers").focus();
  document.getElementById("searchUsers").placeholder = "Type a name or email...";
});

document.getElementById("emptyNewChat").addEventListener("click", () => {
  document.getElementById("searchUsers").focus();
  document.getElementById("searchUsers").placeholder = "Type a name or email...";
});

async function initChatApp() {
  const token = sessionStorage.getItem("accessToken");

  if (!token) {
    showLoginApp();
    return;
  }

  try {
    await loadUsers();
    await loadConversations();
    connectSocket();
  } catch (error) {
    console.error("Chat initialization failed:", error);
    showToast(error.message || "Unable to load your chats. Please try again.");
  }
}