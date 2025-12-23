import { API_BASE_URL } from "./config.js";

const chatBox = document.getElementById("chatBox");
const chatInput = document.getElementById("chatInput");
const chatSend = document.getElementById("chatSend");
const token = localStorage.getItem("token");

async function fetchChatHistory() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/messages`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const messages = await res.json();
        
        chatBox.innerHTML = "";
        messages.forEach(msg => renderMessage(msg));
        scrollToBottom();
    } catch (err) {
        console.error("Inbox load failed:", err);
    }
}

async function handleMessageSend() {
    const text = chatInput.value.trim();
    if (!text) return;

    try {
        const res = await fetch(`${API_BASE_URL}/api/messages`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}` 
            },
            body: JSON.stringify({ message: text })
        });
        
        if (res.ok) {
            renderMessage({ sender: 'user', message: text });
            chatInput.value = "";
            scrollToBottom();
        }
    } catch (err) {
        console.error("Submission failed:", err);
    }
}

function renderMessage(msg) {
    const bubble = document.createElement("div");
    bubble.className = `msg-bubble ${msg.sender}`;
    bubble.textContent = msg.message;
    chatBox.appendChild(bubble);
}

function scrollToBottom() {
    chatBox.scrollTop = chatBox.scrollHeight;
}

// Event Listeners
chatSend.onclick = handleMessageSend;
chatInput.onkeypress = (e) => { if (e.key === "Enter") handleMessageSend(); };

// Initial Load
fetchChatHistory();