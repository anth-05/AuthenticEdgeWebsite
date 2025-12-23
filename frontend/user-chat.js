import { API_BASE_URL } from "./config.js";

const chatBox = document.getElementById("chatBox");
const chatInput = document.getElementById("chatInput");
const chatSend = document.getElementById("chatSend");
const chatToggle = document.getElementById("chatToggle");
const chatWindow = document.querySelector(".chat-window");

const token = localStorage.getItem("token");
const userId = localStorage.getItem("userId"); // Ensure this is saved during login

if (!token || !userId) {
    console.warn("Chat disabled: User not logged in.");
    document.getElementById("chatWidget").style.display = "none";
} else {
    // 1. Connect to Socket
    const socket = io(API_BASE_URL.replace("/api", ""));

    // 2. Join User Room
    socket.emit("join", userId);

    // 3. Toggle Window
    chatToggle.onclick = () => {
        const isVisible = chatWindow.style.display === "flex";
        chatWindow.style.display = isVisible ? "none" : "flex";
        if (!isVisible) loadHistory();
    };

    // 4. Load Previous Messages
    async function loadHistory() {
        try {
            const res = await fetch(`${API_BASE_URL}/api/messages`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const messages = await res.json();
            chatBox.innerHTML = "";
            messages.reverse().forEach(msg => appendMessage(msg));
        } catch (err) {
            console.error("Could not load chat history", err);
        }
    }

    // 5. Send Message
    function sendMessage() {
        const text = chatInput.value.trim();
        if (!text) return;

        const data = { userId, message: text };
        socket.emit("user_msg", data);
        
        // Optimistic UI update
        appendMessage({ sender: 'user', message: text });
        chatInput.value = "";
    }

    chatSend.onclick = sendMessage;
    chatInput.onkeypress = (e) => { if(e.key === 'Enter') sendMessage(); };

    // 6. Receive Admin Reply
    socket.on("new_msg", (msg) => {
        appendMessage(msg);
    });

    // 7. UI Helper
    function appendMessage(msg) {
        const div = document.createElement("div");
        div.className = `message ${msg.sender}`; // user or admin
        div.innerHTML = `
            <div class="msg-content">
                ${msg.message}
            </div>
        `;
        chatBox.appendChild(div);
        chatBox.scrollTop = chatBox.scrollHeight;
    }
}