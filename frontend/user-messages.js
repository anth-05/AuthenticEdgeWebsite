import { API_BASE_URL } from "./config.js";

const chatBox = document.getElementById("chatBox");
const chatInput = document.getElementById("chatInput");
const chatSend = document.getElementById("chatSend");

const token = localStorage.getItem("token");
const userId = localStorage.getItem("userId");

if (!token || !userId) {
    window.location.href = "login.html";
}

// Initialize Socket with Render-friendly settings
const socket = io(API_BASE_URL.replace("/api", ""), {
    transports: ["websocket", "polling"]
});

socket.on("connect", () => {
    socket.emit("join", userId);
    loadHistory();
});

async function loadHistory() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/messages`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const messages = await res.json();
        chatBox.innerHTML = "";
        messages.forEach(msg => appendMessage(msg));
        scrollToBottom();
    } catch (err) {
        chatBox.innerHTML = `<p class="error">Unable to load message history.</p>`;
    }
}

function sendMessage() {
    const text = chatInput.value.trim();
    if (!text) return;

    const msgData = { userId, message: text };
    socket.emit("user_msg", msgData);
    
    appendMessage({ sender: 'user', message: text });
    chatInput.value = "";
    scrollToBottom();
}

socket.on("new_msg", (msg) => {
    appendMessage(msg);
    scrollToBottom();
});

function appendMessage(msg) {
    const div = document.createElement("div");
    div.className = `message ${msg.sender}`;
    div.innerHTML = `<div class="msg-content">${msg.message}</div>`;
    chatBox.appendChild(div);
}

function scrollToBottom() {
    chatBox.scrollTop = chatBox.scrollHeight;
}

chatSend.onclick = sendMessage;
chatInput.onkeypress = (e) => { if (e.key === 'Enter') sendMessage(); };