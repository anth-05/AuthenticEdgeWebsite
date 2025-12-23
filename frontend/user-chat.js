import { API_BASE_URL } from "./config.js";

// ---------- Initialization ----------
const userId = localStorage.getItem("userId"); // Matches login.js key
const token = localStorage.getItem("token");
const chatBox = document.getElementById("chatBox");
const chatInput = document.getElementById("chatInput");
const chatSendBtn = document.getElementById("chatSend");
const chatWidget = document.querySelector('.chat-widget');
const chatToggleBtn = document.querySelector('.chat-toggle-btn');

// Connect to Socket (Server Root)
const socket = io(API_BASE_URL.replace("/api", ""));

document.addEventListener("DOMContentLoaded", () => {
    if (!userId) {
        console.warn("Concierge: No UserID found. Chat disabled.");
        if (chatWidget) chatWidget.style.display = "none";
        return;
    }

    // Join user-specific room for private messages
    socket.emit("join", userId);
    
    // Load history from DB
    loadChatHistory();
});

// ---------- UI Toggles ----------
if (chatToggleBtn && chatWidget) {
    chatToggleBtn.addEventListener('click', () => {
        chatWidget.classList.toggle('open');
        // Scroll to bottom when opened
        if (chatWidget.classList.contains('open')) {
            chatBox.scrollTop = chatBox.scrollHeight;
        }
    });
}

// ---------- Logic ----------

/**
 * Fetch previous messages from the database
 */
async function loadChatHistory() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/subscription`, { // Note: Reuse subscription check or create /api/messages/${userId}
            headers: { Authorization: `Bearer ${token}` }
        });
        // For now, we'll listen for live messages, but you can add a GET route later
    } catch (err) {
        console.error("Chat History Error:", err);
    }
}

/**
 * Append message to the UI
 */
function addMessage(text, sender) {
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${sender === 'user' ? 'user-msg' : 'admin-msg'}`;
    
    // Create inner bubble for styling
    messageDiv.innerHTML = `
        <div class="bubble">
            ${text}
            <span class="time">${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
        </div>
    `;
    
    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}

/**
 * Send message to Admin
 */
function sendMessage() {
    const message = chatInput.value.trim();
    if (!message || !userId) return;

    // 1. Emit to Socket.io
    socket.emit("user_message", {
        userId: userId,
        text: message
    });

    // 2. Clear Input
    chatInput.value = "";
    
    // Note: The message will be added to the UI via the 'new_message' listener below
}

// ---------- Event Listeners ----------

// Listen for messages from the server (both user's own and admin's replies)
socket.on("new_message", (msg) => {
    addMessage(msg.message, msg.sender);
});

chatSendBtn.addEventListener("click", sendMessage);

chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});