import { API_BASE_URL } from "./config.js";

const usersList = document.getElementById("usersList");
const chatBody = document.getElementById("chatBody");
const adminInput = document.getElementById("adminInput");
const sendBtn = document.getElementById("adminSend");
const attachBtn = document.getElementById("attachBtn");
const fileInput = document.getElementById("fileInput");
const badge = document.getElementById("message-badge");

let activeUser = null;

// Connect WebSocket
const socket = io(API_BASE_URL.replace("/api",""));
socket.emit("register", { userId: 0, role: "admin" });

socket.on("newMessage", msg => {
  if (msg.userId !== activeUser) {
    showBadge();
    return;
  }
  appendMessage(msg);
});

// SHOW BADGE
function showBadge() {
  badge.classList.remove("hidden");
  const count = parseInt(badge.textContent) || 0;
  badge.textContent = count + 1;
}

// LOAD USERS
async function loadUsers() {
  const res = await fetch(`${API_BASE_URL}/api/admin/users-with-messages`);
  const users = await res.json();

  usersList.innerHTML = "";

  users.forEach(u => {
    const div = document.createElement("div");
    div.className = "user-row";
    div.textContent = `${u.username}`;
    div.onclick = () => openChat(u.id, u.username);
    usersList.appendChild(div);
  });
}

async function openChat(userId, username) {
  activeUser = userId;
  badge.classList.add("hidden");

  document.getElementById("chatHeader").innerText = username;
  
  const res = await fetch(`${API_BASE_URL}/api/messages/${userId}`);
  const msgs = await res.json();

  chatBody.innerHTML = "";
  msgs.forEach(m => appendMessage(m));
}

function appendMessage(m) {
  const b = document.createElement("div");
  b.className = m.sender === "admin" ? "bubble-admin" : "bubble-user";
  
  if (m.fileUrl) {
    b.innerHTML = `<img src="${m.fileUrl}" class="chat-image">`;
  } else {
    b.textContent = m.message;
  }

  chatBody.appendChild(b);
  chatBody.scrollTop = chatBody.scrollHeight;
}

// SEND MESSAGE
sendBtn.onclick = sendMsg;

function sendMsg() {
  if (!activeUser || !adminInput.value.trim()) return;

  const msg = {
    userId: activeUser,
    sender: "admin",
    message: adminInput.value
  };

  socket.emit("sendMessage", msg);
  appendMessage(msg);
  adminInput.value = "";
}

// FILE UPLOAD
attachBtn.onclick = () => fileInput.click();

fileInput.onchange = async () => {
  const form = new FormData();
  form.append("file", fileInput.files[0]);

  const res = await fetch(`${API_BASE_URL}/api/messages/upload`, {
    method: "POST",
    body: form
  });

  const data = await res.json();

  const msg = {
    userId: activeUser,
    sender: "admin",
    message: "",
    fileUrl: data.url
  };

  socket.emit("sendMessage", msg);
  appendMessage(msg);
};

loadUsers();
