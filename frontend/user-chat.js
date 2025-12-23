// user-chat.js
import { API_BASE_URL } from "./config.js";

const widget = document.querySelector(".chat-widget");
if (!widget) return;

const toggleBtn = widget.querySelector(".chat-toggle-btn");
const windowEl = widget.querySelector(".chat-window");
const bodyEl = widget.querySelector(".chat-body");
const inputEl = widget.querySelector("input");

const token = localStorage.getItem("token");
const userId = localStorage.getItem("userId");

if (!token || !userId) return;

// Socket
const socket = io(API_BASE_URL, { auth: { token } });

socket.emit("join", userId);

// Toggle
toggleBtn.addEventListener("click", () => {
  windowEl.style.display = windowEl.style.display === "flex" ? "none" : "flex";
});

// Send message
inputEl.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" || !inputEl.value.trim()) return;

  const msg = inputEl.value.trim();
  inputEl.value = "";

  appendMessage("You", msg);

  socket.emit("user_msg", {
    userId,
    message: msg
  });
});

// Receive admin reply
socket.on("new_msg", (data) => {
  appendMessage("Concierge", data.message);
});

function appendMessage(sender, text) {
  const div = document.createElement("div");
  div.className = "chat-msg";
  div.innerHTML = `<strong>${sender}:</strong> ${text}`;
  bodyEl.appendChild(div);
  bodyEl.scrollTop = bodyEl.scrollHeight;
}
