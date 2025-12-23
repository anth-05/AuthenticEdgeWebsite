import { API_BASE_URL } from "./config.js";

let activeUser = null;
const usersList = document.getElementById("usersList");
const chatBody = document.getElementById("chatBody");
const chatHeader = document.getElementById("chatHeader");
const adminInput = document.getElementById("adminInput");
const adminSend = document.getElementById("adminSend");
const messageBadge = document.getElementById("message-badge");

/**
 * Fetch all users who have sent messages
 */
async function loadConversations() {
    const token = localStorage.getItem("token");
    try {
        const res = await fetch(`${API_BASE_URL}/api/admin/conversations`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const users = await res.json();
        
        // Update badge with total inquiry count
        messageBadge.textContent = users.length;
        usersList.innerHTML = "";

        users.forEach((u) => {
            const div = document.createElement("div");
            div.className = `user-item ${activeUser === u.user_id ? 'active' : ''}`;
            div.innerHTML = `
                <div class="user-avatar">${u.email.charAt(0).toUpperCase()}</div>
                <div class="user-meta">
                    <span class="user-email">${u.email}</span>
                    <span class="last-msg">Click to view inquiry</span>
                </div>
            `;
            div.onclick = () => openChat(u.user_id, u.email);
            usersList.appendChild(div);
        });
    } catch (err) {
        console.error("Error loading conversations:", err);
    }
}

/**
 * Open specific chat and render bubbles
 */
async function openChat(userId, email) {
    activeUser = userId;
    chatHeader.innerHTML = `<span class="eyebrow">CONVERSATION WITH</span><h3>${email}</h3>`;
    
    const token = localStorage.getItem("token");
    try {
        const res = await fetch(`${API_BASE_URL}/api/admin/messages/${userId}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const msgs = await res.json();

        chatBody.innerHTML = "";
        msgs.forEach(renderMessage);
        chatBody.scrollTop = chatBody.scrollHeight;
    } catch (err) {
        console.error("Error loading messages:", err);
    }
}

/**
 * Send reply via REST API
 */
async function sendMsg() {
    const text = adminInput.value.trim();
    if (!text || !activeUser) return;

    const token = localStorage.getItem("token");
    try {
        const res = await fetch(`${API_BASE_URL}/api/admin/reply`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}` 
            },
            body: JSON.stringify({ userId: activeUser, message: text })
        });

        if (res.ok) {
            renderMessage({ sender: "admin", message: text });
            adminInput.value = "";
            chatBody.scrollTop = chatBody.scrollHeight;
        }
    } catch (err) {
        alert("Failed to send message.");
    }
}

function renderMessage(msg) {
    const div = document.createElement("div");
    // Perspective: Admin bubbles on right, User on left
    div.className = `message ${msg.sender}`;
    div.innerHTML = `<div class="bubble">${msg.message}</div>`;
    chatBody.appendChild(div);
}

// 5-Second Polling Loop (Replaces Socket.io)
setInterval(() => {
    loadConversations();
    if (activeUser) {
        // Refresh active chat history to see new user messages
        const token = localStorage.getItem("token");
        fetch(`${API_BASE_URL}/api/admin/messages/${activeUser}`, {
            headers: { Authorization: `Bearer ${token}` },
        })
        .then(res => res.json())
        .then(msgs => {
            // Only re-render if message count has changed
            if (msgs.length !== chatBody.children.length) {
                chatBody.innerHTML = "";
                msgs.forEach(renderMessage);
                chatBody.scrollTop = chatBody.scrollHeight;
            }
        });
    }
}, 5000);

adminSend.onclick = sendMsg;
adminInput.onkeypress = (e) => { if (e.key === "Enter") sendMsg(); };
loadConversations();