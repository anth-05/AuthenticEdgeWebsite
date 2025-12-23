import { API_BASE_URL } from "./config.js";

const chatWidget = document.getElementById("chatWidget");
const chatBox = document.getElementById("chatBox");
const chatInput = document.getElementById("chatInput");
const chatSend = document.getElementById("chatSend");
const chatToggle = document.getElementById("chatToggle");

// 1. ALWAYS SHOW THE BUBBLE
chatWidget.style.display = "flex";

let socket = null;

chatToggle.onclick = () => {
    // RE-FETCH tokens every time the bubble is clicked
    const currentToken = localStorage.getItem("token");
    const currentUserId = localStorage.getItem("userId");

    chatWidget.classList.toggle("open");
    
    if (chatWidget.classList.contains("open")) {
        if (currentToken && currentUserId) {
            // User is logged in
            if (!socket) {
                initConnection(currentToken, currentUserId);
            }
            loadHistory(currentToken);
        } else {
            // User is NOT logged in
            chatBox.innerHTML = `
                <div style="padding: 20px; text-align: center; color: #666; font-size: 0.85rem;">
                    <p>Please <strong>Login</strong> to speak with our concierge.</p>
                    <a href="login.html" style="display: inline-block; margin-top: 10px; color: #000; text-decoration: underline;">Login here</a>
                </div>`;
        }
    }
};

function initConnection(token, userId) {
    socket = io(API_BASE_URL.replace("/api", ""));
    socket.emit("join", userId);

    socket.on("new_msg", (msg) => {
        appendMessage(msg);
    });

    chatSend.onclick = () => sendMessage(userId);
    chatInput.onkeypress = (e) => { if (e.key === 'Enter') sendMessage(userId); };
}

async function loadHistory(token) {
    try {
        const res = await fetch(`${API_BASE_URL}/api/messages`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const messages = await res.json();
        chatBox.innerHTML = "";
        messages.forEach(msg => appendMessage(msg));
    } catch (err) {
        console.error("History error:", err);
    }
}

function sendMessage(userId) {
    const text = chatInput.value.trim();
    if (!text || !socket) return;
    socket.emit("user_msg", { userId, message: text });
    appendMessage({ sender: 'user', message: text });
    chatInput.value = "";
}

function appendMessage(msg) {
    const div = document.createElement("div");
    div.className = `message ${msg.sender}`;
    div.innerHTML = `<div class="msg-content">${msg.message}</div>`;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
}