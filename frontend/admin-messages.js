import { API_BASE_URL } from "./config.js";

const socket = io("https://authenticedgewebsite-1.onrender.com", {
  transports: ["websocket", "polling"],
});

let activeUser = null;

socket.on("connect", () => {
  console.log("🟢 Admin connected:", socket.id);
  socket.emit("join", "admin_global");
});

socket.on("connect_error", err => {
  console.error("Socket error:", err.message);
});

socket.on("admin_notification", msg => {
  if (activeUser && String(msg.user_id) === String(activeUser)) {
    appendMessage(msg);
  } else {
    showBadge();
    loadConversations();
  }
});

/* ---------- FUNCTIONS ---------- */

async function loadConversations() {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_BASE_URL}/api/admin/conversations`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const users = await res.json();
  usersList.innerHTML = "";

  users.forEach(u => {
    const div = document.createElement("div");
    div.className = "user-row";
    div.textContent = u.email;
    div.onclick = () => openChat(u.user_id, u.email);
    usersList.appendChild(div);
  });
}

async function openChat(userId, email) {
  activeUser = userId;
  chatHeader.textContent = email;

  const token = localStorage.getItem("token");
  const res = await fetch(
    `${API_BASE_URL}/api/admin/messages/${userId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const msgs = await res.json();

  chatBody.innerHTML = "";
  msgs.forEach(appendMessage);
}

function sendMsg() {
  const text = adminInput.value.trim();
  if (!text || !activeUser) return;

  socket.emit("admin_reply", { userId: activeUser, text });

  appendMessage({
    sender: "admin",
    message: text,
    created_at: new Date(),
  });

  adminInput.value = "";
}
