import { API_BASE_URL } from "./config.js";

let socket = null;

function initSocket(userId) {
  socket = io("https://authenticedgewebsite-1.onrender.com", {
    transports: ["websocket", "polling"],
  });

  socket.on("connect", () => {
    console.log("🟢 User connected:", socket.id);
    socket.emit("join", userId);
  });

  socket.on("connect_error", err => {
    console.error("Socket error:", err.message);
  });

  socket.on("new_msg", msg => appendMessage(msg));
}

async function loadHistory() {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_BASE_URL}/api/messages`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const msgs = await res.json();
  chatBox.innerHTML = "";
  msgs.forEach(appendMessage);
}

function sendMessage(userId) {
  const text = chatInput.value.trim();
  if (!text) return;

  socket.emit("user_msg", { userId, message: text });
  appendMessage({ sender: "user", message: text });
  chatInput.value = "";
}
