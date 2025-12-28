import { API_BASE_URL } from "./config.js";

let activeUser = null;
const messagesLayout = document.querySelector(".messages-layout"); // For mobile sliding
const usersList = document.getElementById("usersList");
const chatBody = document.getElementById("chatBody");
const chatHeader = document.getElementById("chatHeader");
const adminInput = document.getElementById("adminInput");
const adminSend = document.getElementById("adminSend");
const messageBadge = document.getElementById("message-badge");
const fileInput = document.getElementById("fileInput");
const attachBtn = document.getElementById("attachBtn");

// Elements for image preview
const imagePreviewContainer = document.getElementById("imagePreviewContainer");
const imagePreview = document.getElementById("imagePreview");
const clearPreview = document.getElementById("clearPreview");

if (attachBtn) attachBtn.onclick = () => fileInput.click();

/**
 * 1. LOAD INBOX SIDEBAR
 */
async function loadInbox() {
    const token = localStorage.getItem("token");
    try {
        const res = await fetch(`${API_BASE_URL}/api/admin/conversations`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        const data = await res.json();
        const users = Array.isArray(data) ? data : data.rows;

        if (!Array.isArray(users) || users.length === 0) {
            if (messageBadge) messageBadge.textContent = "0";
            usersList.innerHTML = "<p style='padding:20px; font-size:0.7rem; color:#999;'>NO INQUIRIES FOUND.</p>";
            return;
        }

        if (messageBadge) messageBadge.textContent = users.length;
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
 * 2. SELECT & LOAD CHAT (Updated for Mobile Slide)
 */
async function selectConversation(userId, email) {
    activeUser = userId;
    
    // Toggle Mobile Slide
    if (messagesLayout) {
        messagesLayout.classList.add('chat-open');
    }

    // UI Update: Highlight active
    document.querySelectorAll('.user-item').forEach(item => {
        item.classList.remove('active');
        if(item.querySelector(`.convo-checkbox[data-id="${userId}"]`)) item.classList.add('active');
    });

    chatHeader.innerHTML = `
        <div style="display:flex; align-items:center; gap:15px; width:100%;">
            <span class="mobile-back-btn" onclick="closeChatMobile()" style="display:none; cursor:pointer; font-weight:800; font-size:1.2rem;">←</span>
            <div style="display:flex; flex-direction:column;">
                <span class="eyebrow">CONVERSATION WITH</span>
                <h3>${email}</h3>
            </div>
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
 * Mobile Navigation Helper
 */
function closeChatMobile() {
    if (messagesLayout) {
        messagesLayout.classList.remove('chat-open');
    }
}

/**
 * 3. FILE PREVIEW & REPLY
 */
if (fileInput) {
    fileInput.onchange = () => {
        const file = fileInput.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                if (imagePreview) imagePreview.src = e.target.result;
                if (imagePreviewContainer) imagePreviewContainer.style.display = "block";
            }
            reader.readAsDataURL(file);
        }
    };
}

if (clearPreview) {
    clearPreview.onclick = () => {
        fileInput.value = "";
        if (imagePreviewContainer) imagePreviewContainer.style.display = "none";
        if (imagePreview) imagePreview.src = "";
    };
}

async function handleReply() {
    const text = adminInput.value.trim();
    const file = fileInput.files[0];
    if (!text && !file) return;

    const fd = new FormData();
    fd.append("userId", activeUser);
    fd.append("message", text);
    if (file) fd.append("imageFile", file);

    const token = localStorage.getItem("token");
    try {
        const res = await fetch(`${API_BASE_URL}/api/admin/reply`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}` },
            body: fd
        });

        if (res.ok) {
            const data = await res.json();
            renderBubble(data);
            
            adminInput.value = "";
            fileInput.value = "";
            if (imagePreviewContainer) imagePreviewContainer.style.display = "none";
            scrollToBottom();
        }
    } catch (err) {
        alert("Failed to deliver message.");
    }
}

/**
 * 4. UI RENDER & HELPERS
 */
function renderBubble(msg) {
    const wrapper = document.createElement("div");
    wrapper.className = `message-wrapper ${msg.sender === 'admin' ? 'admin-align' : 'user-align'}`;
    
    let content = msg.message || "";
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
    content = content.replace(urlRegex, (url) => {
        let href = url.startsWith('http') ? url : `https://${url}`;
        return `<a href="${href}" target="_blank" class="chat-link">${url}</a>`;
    });

    let imageHtml = msg.file_url ? `<img src="${msg.file_url}" class="chat-image" onclick="window.open(this.src)">` : "";

    wrapper.innerHTML = `
        <div class="bubble ${msg.sender}">
            ${imageHtml}
            ${content ? `<div>${content}</div>` : ""}
        </div>
    `;
    chatBody.appendChild(wrapper);
}

function setupInboxHeader() {
    const header = document.querySelector('.inbox-header');
    if (!document.getElementById('selectAllContainer') && header) {
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
                closeChatMobile(); // Ensure we go back to inbox on mobile
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
        await Promise.all(selectedIds.map(id => 
            fetch(`${API_BASE_URL}/api/admin/conversations/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            })
        ));
        
        if (selectedIds.includes(String(activeUser))) {
            activeUser = null;
            chatBody.innerHTML = "";
            chatHeader.innerHTML = '<span class="eyebrow">Select a conversation</span>';
            closeChatMobile();
        }
        
        loadInbox();
        const selectAll = document.getElementById('selectAll');
        if (selectAll) selectAll.checked = false;
    } catch (err) {
        alert("Bulk delete encountered an error.");
    }
}

function scrollToBottom() {
    chatBody.scrollTop = chatBody.scrollHeight;
}

/* --- INIT --- */
if (adminSend) adminSend.onclick = handleReply;
if (adminInput) {
    adminInput.onkeypress = (e) => { if (e.key === "Enter") handleReply(); };
}

/* --- EXPOSE TO GLOBAL SCOPE --- */
window.selectConversation = selectConversation;
window.deleteConversation = deleteConversation;
window.bulkDelete = bulkDelete;
window.closeChatMobile = closeChatMobile;

loadInbox();
setInterval(loadInbox, 15000);