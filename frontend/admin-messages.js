import { API_BASE_URL } from "./config.js";

const usersList = document.getElementById("usersList");
const chatBody = document.getElementById("chatBody");
const adminInput = document.getElementById("adminInput");
const sendBtn = document.getElementById("adminSend");
const fileInput = document.getElementById("fileInput");
const badge = document.getElementById("message-badge");
const chatHeaderName = document.getElementById("chatHeader");

let activeUser = null;

// ---------- Socket.io Connection ----------
// Point to the base URL (Socket.io lives on the server root, not /api)
const socket = io(API_BASE_URL.replace("/api", ""));

// Join as admin to receive global notifications
socket.emit("join", "admin_global");

socket.on("admin_notification", (msg) => {
    if (activeUser && msg.user_id === activeUser) {
        appendMessage(msg);
    } else {
        showBadge();
        loadConversations(); // Refresh the list to show newest message preview
    }
});

// ---------- UI Functions ----------

function showBadge() {
    if (badge) {
        badge.classList.remove("hidden");
        const count = parseInt(badge.textContent) || 0;
        badge.textContent = count + 1;
    }
}

async function loadConversations() {
    const token = localStorage.getItem("token");
    try {
        const res = await fetch(`${API_BASE_URL}/api/admin/conversations`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const conversations = await res.json();

        usersList.innerHTML = "";
        conversations.forEach(u => {
            const div = document.createElement("div");
            div.className = `user-row ${activeUser === u.user_id ? 'active' : ''}`;
            div.innerHTML = `
                <div class="user-info">
                    <strong>${u.email}</strong>
                    <p class="last-msg">${u.message || "No messages yet"}</p>
                </div>
            `;
            div.onclick = () => openChat(u.user_id, u.email);
            usersList.appendChild(div);
        });
    } catch (err) {
        console.error("Failed to load conversations:", err);
    }
}

async function openChat(userId, email) {
    activeUser = userId;
    if (badge) badge.classList.add("hidden");
    
    // UI Update
    chatHeaderName.innerText = email;
    document.querySelectorAll('.user-row').forEach(row => row.classList.remove('active'));
    
    const token = localStorage.getItem("token");
    try {
        const res = await fetch(`${API_BASE_URL}/api/admin/messages/${userId}`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const msgs = await res.json();

        chatBody.innerHTML = "";
        msgs.forEach(m => appendMessage(m));
        chatBody.scrollTop = chatBody.scrollHeight;
    } catch (err) {
        console.error("Error loading chat history:", err);
    }
}

function appendMessage(m) {
    const div = document.createElement("div");
    // Align with backend 'sender' values: 'admin' or 'user'
    div.className = `message-wrapper ${m.sender === "admin" ? "admin" : "user"}`;
    
    div.innerHTML = `
        <div class="msg-bubble">
            ${m.file_url ? `<img src="${m.file_url}" class="chat-image">` : m.message}
            <small class="msg-time">${new Date(m.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</small>
        </div>
    `;

    chatBody.appendChild(div);
    chatBody.scrollTop = chatBody.scrollHeight;
}

// ---------- Actions ----------

async function sendMsg() {
    const text = adminInput.value.trim();
    if (!activeUser || !text) return;

    const msgData = {
        userId: activeUser,
        text: text
    };

    // Emit via Socket for real-time
    socket.emit("admin_reply", msgData);

    // Optimistic UI update (add to screen immediately)
    appendMessage({
        sender: "admin",
        message: text,
        created_at: new Date()
    });

    adminInput.value = "";
}

// Event Listeners
sendBtn.addEventListener("click", sendMsg);
adminInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendMsg();
});

// Initialization
loadConversations();