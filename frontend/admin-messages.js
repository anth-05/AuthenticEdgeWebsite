import { API_BASE_URL } from "./config.js";

let activeUser = null;
const usersList = document.getElementById("usersList");
const chatBody = document.getElementById("chatBody");
const chatHeader = document.getElementById("chatHeader");
const adminInput = document.getElementById("adminInput");
const adminSend = document.getElementById("adminSend");
const messageBadge = document.getElementById("message-badge");

/**
 * 1. LOAD INBOX SIDEBAR (Updated with Checkboxes and Delete X)
 */
async function loadInbox() {
    const token = localStorage.getItem("token");
    try {
        const res = await fetch(`${API_BASE_URL}/api/admin/conversations`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const users = await res.json();
        
        if (!Array.isArray(users) || users.length === 0) {
            messageBadge.textContent = "0";
            usersList.innerHTML = "<p style='padding:20px; font-size:0.7rem; color:#999;'>NO INQUIRIES FOUND.</p>";
            return;
        }

        messageBadge.textContent = users.length;
        
        // Add "Select All" toggle to the inbox header if it doesn't exist
        setupInboxHeader();

        usersList.innerHTML = "";
        users.forEach(u => {
            const div = document.createElement("div");
            div.className = `user-item ${activeUser === u.user_id ? 'active' : ''}`;
            div.setAttribute('data-user-id', u.user_id);
            
            div.innerHTML = `
                <div class="user-item-content">
                    <input type="checkbox" class="convo-checkbox" data-id="${u.user_id}">
                    <div class="user-info" onclick="selectConversation(${u.user_id}, '${u.email}')">
                        <span class="user-email">${u.email}</span>
                        <span class="last-msg">View private inquiry</span>
                    </div>
                    <button class="delete-x" onclick="event.stopPropagation(); deleteConversation(${u.user_id})">×</button>
                </div>
            `;
            usersList.appendChild(div);
        });
    } catch (err) {
        console.error("Inbox load error:", err);
    }
}

function setupInboxHeader() {
    const header = document.querySelector('.inbox-header');
    if (!document.getElementById('selectAllContainer')) {
        const container = document.createElement('div');
        container.id = 'selectAllContainer';
        container.innerHTML = `
            <label class="select-all-label">
                <input type="checkbox" id="selectAll"> ALL
            </label>
            <button id="deleteSelected" class="bulk-delete-btn">DELETE SELECTED</button>
        `;
        header.after(container);

        document.getElementById('selectAll').onchange = (e) => {
            document.querySelectorAll('.convo-checkbox').forEach(cb => cb.checked = e.target.checked);
        };

        document.getElementById('deleteSelected').onclick = bulkDelete;
    }
}

/**
 * 2. DELETE CONVERSATION
 */
async function deleteConversation(userId) {
    if (!confirm("Permanently delete this conversation?")) return;

    const token = localStorage.getItem("token");
    try {
        const res = await fetch(`${API_BASE_URL}/api/admin/conversations/${userId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` }
        });

        if (res.ok) {
            if (activeUser === userId) {
                chatBody.innerHTML = "";
                chatHeader.innerHTML = '<span class="eyebrow">Select a conversation</span>';
                activeUser = null;
            }
            loadInbox();
        }
    } catch (err) {
        alert("Delete failed.");
    }
}

async function bulkDelete() {
    const selectedIds = Array.from(document.querySelectorAll('.convo-checkbox:checked'))
                            .map(cb => cb.getAttribute('data-id'));
    
    if (selectedIds.length === 0) return;
    if (!confirm(`Delete ${selectedIds.length} conversations?`)) return;

    const token = localStorage.getItem("token");
    // You can loop through or create a bulk endpoint on your backend
    for (const id of selectedIds) {
        await fetch(`${API_BASE_URL}/api/admin/conversations/${id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` }
        });
    }
    loadInbox();
}

// ... rest of your existing selectConversation, handleReply, renderBubble functions ...
/**
 * 1. LOAD INBOX SIDEBAR
 */
async function loadInbox() {
    const token = localStorage.getItem("token");
    try {
        const res = await fetch(`${API_BASE_URL}/api/admin/conversations`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const users = await res.json();
        
        if (!Array.isArray(users) || users.length === 0) {
            messageBadge.textContent = "0";
            usersList.innerHTML = "<p style='padding:20px; font-size:0.7rem; color:#999;'>NO INQUIRIES FOUND.</p>";
            return;
        }

        messageBadge.textContent = users.length;
        
        // Render users list
        usersList.innerHTML = "";
        users.forEach(u => {
            const div = document.createElement("div");
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
 */
async function selectConversation(userId, email) {
    activeUser = userId;
    
    // Highlight the selected user in the sidebar
    document.querySelectorAll('.user-item').forEach(item => item.classList.remove('active'));
    
    chatHeader.innerHTML = `
        <div style="display:flex; flex-direction:column;">
            <span class="eyebrow">CONVERSATION WITH</span>
            <h3>${email}</h3>
        </div>
    `;
    
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
            renderBubble({ sender: 'admin', message: text });
            adminInput.value = "";
            scrollToBottom();
        }
    } catch (err) {
        alert("Failed to deliver message.");
    }
}

/**
 * 4. RENDER BUBBLES (With Inquiry Formatting)
 */
function renderBubble(msg) {
    const wrapper = document.createElement("div");
    wrapper.className = `message-wrapper ${msg.sender === 'admin' ? 'admin-align' : 'user-align'}`;
    
    let content = msg.message;
    let extraClass = "";
    
    // Detect product inquiry from single-product.js
    if (content.startsWith("INQUIRY:")) {
        extraClass = "inquiry-bubble";
        content = content.replace("INQUIRY:", "<strong>PRODUCT INQUIRY</strong><br>");
    }

    wrapper.innerHTML = `
        <div class="bubble ${msg.sender} ${extraClass}">
            ${content}
        </div>
    `;
    chatBody.appendChild(wrapper);
}

function scrollToBottom() {
    chatBody.scrollTop = chatBody.scrollHeight;
}

/* --- EVENT LISTENERS --- */
adminSend.onclick = handleReply;
adminInput.onkeypress = (e) => { if (e.key === "Enter") handleReply(); };

setInterval(loadInbox, 10000);
loadInbox();