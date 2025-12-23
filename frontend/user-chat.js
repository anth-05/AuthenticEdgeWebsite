import { API_BASE_URL } from "./config.js";

const chatWidget = document.getElementById("chatWidget");
const chatBox = document.getElementById("chatBox");
const chatInput = document.getElementById("chatInput");
const chatSend = document.getElementById("chatSend");
const chatToggle = document.getElementById("chatToggle");

const token = localStorage.getItem("token");
const userId = localStorage.getItem("userId");

// 1. ALWAYS SHOW THE BUBBLE
// Remove the code that sets display to "none"
chatWidget.style.display = "flex";

// 2. TOGGLE LOGIC (Uses the .open class from your CSS)
chatToggle.onclick = () => {
    chatWidget.classList.toggle("open");
    
    // If opening and logged in, load history
    if (chatWidget.classList.contains("open") && token && userId) {
        loadHistory();
    } 
    // If opening and NOT logged in, show a notice
    else if (chatWidget.classList.contains("open")) {
        chatBox.innerHTML = `
            <div style="padding: 20px; text-align: center; color: #666; font-size: 0.85rem;">
                <p>Please <strong>Login</strong> to speak with our concierge.</p>
                <a href="login.html" style="display: inline-block; margin-top: 10px; color: #000; text-decoration: underline;">Login here</a>
            </div>`;
    }
};

// 3. SOCKET LOGIC (Only runs if logged in)
if (token && userId) {
    const socket = io(API_BASE_URL.replace("/api", ""));
    socket.emit("join", userId);

    async function loadHistory() {
        try {
            const res = await fetch(`${API_BASE_URL}/api/messages`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const messages = await res.json();
            chatBox.innerHTML = "";
            messages.forEach(msg => appendMessage(msg)); // Removed .reverse() as DB order is usually correct
        } catch (err) {
            console.error("History error:", err);
        }
    }

    function sendMessage() {
        const text = chatInput.value.trim();
        if (!text) return;
        socket.emit("user_msg", { userId, message: text });
        appendMessage({ sender: 'user', message: text });
        chatInput.value = "";
    }

    chatSend.onclick = sendMessage;
    chatInput.onkeypress = (e) => { if (e.key === 'Enter') sendMessage(); };

    socket.on("new_msg", (msg) => {
        appendMessage(msg);
    });
}

function appendMessage(msg) {
    const div = document.createElement("div");
    div.className = `message ${msg.sender}`;
    div.innerHTML = `<div class="msg-content">${msg.message}</div>`;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
}