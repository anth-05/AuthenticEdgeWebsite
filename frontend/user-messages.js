import { API_BASE_URL } from "./config.js";

const chatBox = document.getElementById("chatBox");
const chatInput = document.getElementById("chatInput");
const chatSend = document.getElementById("chatSend");
const token = localStorage.getItem("token");

// 1. Load history when the page opens
async function loadMyMessages() {
    const res = await fetch(`${API_BASE_URL}/api/messages`, {
        headers: { "Authorization": `Bearer ${token}` }
    });
    const msgs = await res.json();
    chatBox.innerHTML = "";
    msgs.forEach(msg => appendBubble(msg));
    chatBox.scrollTop = chatBox.scrollHeight;
}

// 2. Save new message to database
async function sendMessage() {
    const text = chatInput.value.trim();
    if (!text) return;

    await fetch(`${API_BASE_URL}/api/messages`, {
        method: "POST",
        headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}` 
        },
        body: JSON.stringify({ message: text })
    });

    appendBubble({ sender: 'user', message: text });
    chatInput.value = "";
    chatBox.scrollTop = chatBox.scrollHeight;
}

function appendBubble(msg) {
    const div = document.createElement("div");
    div.className = `msg-bubble ${msg.sender}`;
    div.textContent = msg.message;
    chatBox.appendChild(div);
}
function scrollToBottom() {
    const stream = document.querySelector('.message-stream');
    stream.scrollTop = stream.scrollHeight;
}
// Call this after loadMyMessages() and after sending a message

chatSend.onclick = sendMessage;
loadMyMessages();
scrollToBottom();