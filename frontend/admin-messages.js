import { API_BASE_URL } from "./config.js";

let activeUser = null;
const usersList = document.getElementById("usersList");
const chatBody = document.getElementById("chatBody");
const chatHeader = document.getElementById("chatHeader");
const adminInput = document.getElementById("adminInput");
const adminSend = document.getElementById("adminSend");
const messageBadge = document.getElementById("message-badge");
const fileInput = document.getElementById("fileInput");
/**
 * 1. LOAD INBOX SIDEBAR
 */
async function loadInbox() {
    const token = localStorage.getItem("token");
    try {
        const res = await fetch(`${API_BASE_URL}/api/admin/conversations`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        // Handle Postgres Result Envelope
        const data = await res.json();
        const users = Array.isArray(data) ? data : data.rows;

        if (!Array.isArray(users) || users.length === 0) {
            messageBadge.textContent = "0";
            usersList.innerHTML = "<p style='padding:20px; font-size:0.7rem; color:#999;'>NO INQUIRIES FOUND.</p>";
            return;
        }

        messageBadge.textContent = users.length;
        setupInboxHeader();

        usersList.innerHTML = "";
        users.forEach(u => {
            const div = document.createElement("div");
            div.className = `user-item ${activeUser === u.user_id ? 'active' : ''}`;
            
            div.innerHTML = `
                <div class="user-item-content">
                    <input type="checkbox" class="convo-checkbox" data-id="${u.user_id}" onclick="event.stopPropagation()">
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

/**
 * 2. SELECT & LOAD CHAT
 */
async function selectConversation(userId, email) {
    activeUser = userId;
    
    // UI Update: Highlight active
    document.querySelectorAll('.user-item').forEach(item => {
        item.classList.remove('active');
        if(item.querySelector(`.convo-checkbox[data-id="${userId}"]`)) item.classList.add('active');
    });

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
        const data = await res.json();
        const messages = Array.isArray(data) ? data : data.rows;

        chatBody.innerHTML = "";
        if (Array.isArray(messages)) {
            messages.forEach(renderBubble);
        }
        scrollToBottom();
    } catch (err) {
        console.error("History load error:", err);
    }
}

/**
 * 3. DELETE LOGIC
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
        console.error("Delete error:", err);
    }
}

async function bulkDelete() {
    const selectedIds = Array.from(document.querySelectorAll('.convo-checkbox:checked'))
                            .map(cb => cb.getAttribute('data-id'));
    
    if (selectedIds.length === 0) return;
    if (!confirm(`Permanently delete ${selectedIds.length} conversations?`)) return;

    const token = localStorage.getItem("token");
    
    try {
        // Run all deletes
        await Promise.all(selectedIds.map(id => 
            fetch(`${API_BASE_URL}/api/admin/conversations/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            })
        ));
        
        // Reset UI if active user was deleted
        if (selectedIds.includes(String(activeUser))) {
            activeUser = null;
            chatBody.innerHTML = "";
            chatHeader.innerHTML = '<span class="eyebrow">Select a conversation</span>';
        }
        
        loadInbox();
        document.getElementById('selectAll').checked = false;
    } catch (err) {
        alert("Bulk delete encountered an error.");
    }
}

/**
 * 4. UI HELPERS
 */
function setupInboxHeader() {
    const header = document.querySelector('.inbox-header');
    if (!document.getElementById('selectAllContainer')) {
        const container = document.createElement('div');
        container.id = 'selectAllContainer';
        container.innerHTML = `
            <label class="select-all-label">
                <input type="checkbox" id="selectAll"> SELECT ALL
            </label>
            <button id="deleteSelected" class="bulk-delete-btn">DELETE</button>
        `;
        header.after(container);

        document.getElementById('selectAll').onchange = (e) => {
            document.querySelectorAll('.convo-checkbox').forEach(cb => cb.checked = e.target.checked);
        };
        document.getElementById('deleteSelected').onclick = bulkDelete;
    }
}

async function handleReply() {
    const text = adminInput.value.trim();
    const file = fileInput.files[0];
    
    // Only proceed if there is text OR a file
    if ((!text && !file) || !activeUser) return;

    const token = localStorage.getItem("token");
    const formData = new FormData();
    formData.append("userId", activeUser);
    if (text) formData.append("message", text);
    if (file) formData.append("image", file); // Must match backend field name

            try {
        const res = await fetch(`${API_BASE_URL}/api/admin/reply`, {
            method: "POST",
            headers: { 
                // "Content-Type" MUST BE DELETED HERE
                "Authorization": `Bearer ${token}` 
            },
            body: formData // The browser handles the Content-Type automatically
        });

        if (res.ok) {
            const data = await res.json();
            // Render the message with the returned file_url
            renderBubble({ 
                sender: 'admin', 
                message: text, 
                file_url: data.file_url 
            });
            
            // Clear inputs
            adminInput.value = "";
            fileInput.value = ""; 
            scrollToBottom();
        }
    } catch (err) {
        alert("Failed to deliver message.");
    }
}

/**
 * Update Render Bubble to show images
 */
function renderBubble(msg) {
    const wrapper = document.createElement("div");
    wrapper.className = `message-wrapper ${msg.sender === 'admin' ? 'admin-align' : 'user-align'}`;
    
    let content = msg.message || "";
    let extraClass = "";
    
    // Convert links to clickable <a> tags
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
    content = content.replace(urlRegex, (url) => {
        let href = url.startsWith('http') ? url : `https://${url}`;
        return `<a href="${href}" target="_blank" class="chat-link">${url}</a>`;
    });

    // Handle Images
    let imageHtml = "";
    if (msg.file_url) {
        imageHtml = `<img src="${msg.file_url}" class="chat-image" onclick="window.open(this.src)">`;
    }

    wrapper.innerHTML = `
        <div class="bubble ${msg.sender} ${extraClass}">
            ${imageHtml}
            ${content ? `<div>${content}</div>` : ""}
        </div>
    `;
    chatBody.appendChild(wrapper);
}
function scrollToBottom() {
    chatBody.scrollTop = chatBody.scrollHeight;
}

/* --- INIT --- */
adminSend.onclick = handleReply;
adminInput.onkeypress = (e) => { if (e.key === "Enter") handleReply(); };

/* --- EXPOSE TO GLOBAL SCOPE --- */
window.selectConversation = selectConversation;
window.deleteConversation = deleteConversation;
window.bulkDelete = bulkDelete;
loadInbox();
setInterval(loadInbox, 15000); // 15s refresh