import { API_BASE_URL } from "./config.js";

let activeUser = null;
const usersList = document.getElementById("usersList");
const chatBody = document.getElementById("chatBody");
const chatHeader = document.getElementById("chatHeader");
const adminInput = document.getElementById("adminInput");
const adminSend = document.getElementById("adminSend");
const messageBadge = document.getElementById("message-badge");

/**
 * 1. INITIAL LOAD & POLLING
 * Fetches the user list for the sidebar
 */
async function loadInbox() {
    const token = localStorage.getItem("token");
    try {
        const res = await fetch(`${API_BASE_URL}/api/admin/conversations`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const users = await res.json();
        
        messageBadge.textContent = users.length;
        usersList.innerHTML = "";

        users.forEach(u => {
            const div = document.createElement("div");
            // Match the 'active' class from your CSS
            div.className = `user-item ${activeUser === u.user_id ? 'active' : ''}`;
            div.innerHTML = `
                <span class="user-email">${u.email}</span>
                <span class="last-msg">View private inquiry</span>
            `;
            div.onclick = () => selectConversation(u.user_id, u.email);
            usersList.appendChild(div);
        });
    } catch (err) {
        console.error("Inbox load error:", err);
    }
}

/**
 * 2. LOAD INDIVIDUAL CHAT
 * Fetches history for a specific user ID
 */
async function selectConversation(userId, email) {
    activeUser = userId;
    
    // Update Header to show who you are talking to
    chatHeader.innerHTML = `<span class="eyebrow">CONVERSATION WITH</span><h3>${email}</h3>`;
    
    const token = localStorage.getItem("token");
    try {
        const res = await fetch(`${API_BASE_URL}/api/admin/messages/${userId}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const messages = await res.json();

        chatBody.innerHTML = "";
        messages.forEach(renderBubble);
        scrollToBottom();
    } catch (err) {
        console.error("History load error:", err);
    }
}

/**
 * 3. SEND REPLY
 * POSTs the message to the database
 */
async function handleReply() {
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
            // Optimistically render the bubble
            renderBubble({ sender: 'admin', message: text });
            adminInput.value = "";
            scrollToBottom();
        }
    } catch (err) {
        alert("Failed to deliver message.");
    }
}

/**
 * 4. RENDER BUBBLES
 * Uses your 'message admin' and 'message user' classes
 */
function renderBubble(msg) {
    const div = document.createElement("div");
    div.className = `message ${msg.sender}`; 
    // Match your CSS .bubble structure
    div.innerHTML = `<div class="bubble">${msg.message}</div>`;
    chatBody.appendChild(div);
}

function scrollToBottom() {
    chatBody.scrollTop = chatBody.scrollHeight;
}

/* --- EVENT LISTENERS --- */
adminSend.onclick = handleReply;
adminInput.onkeypress = (e) => { if (e.key === "Enter") handleReply(); };

// Polling every 10 seconds just to keep the inbox fresh without sockets
setInterval(loadInbox, 10000);

// Initial Load
loadInbox();