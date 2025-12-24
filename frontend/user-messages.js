import { API_BASE_URL } from "./config.js";

const chatBox = document.getElementById("chatBox");
const chatInput = document.getElementById("chatInput");
const chatSend = document.getElementById("chatSend");
const fileInput = document.getElementById("fileInput");
const attachBtn = document.getElementById("attachBtn");
const imagePreviewContainer = document.getElementById("imagePreviewContainer");
const imagePreview = document.getElementById("imagePreview");
const clearPreview = document.getElementById("clearPreview");

// 1. Image Preview Logic
attachBtn.onclick = () => fileInput.click();

fileInput.onchange = () => {
    const file = fileInput.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            imagePreview.src = e.target.result;
            imagePreviewContainer.style.display = "block";
        };
        reader.readAsDataURL(file);
    }
};

clearPreview.onclick = () => {
    fileInput.value = "";
    imagePreviewContainer.style.display = "none";
};

// 2. Link Detection & Rendering
function renderMessage(msg) {
    const bubble = document.createElement("div");
    bubble.className = `msg-bubble ${msg.sender}`;
    
    let content = msg.message || "";
    
    // Convert text URLs to clickable links
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
    content = content.replace(urlRegex, (url) => {
        let href = url.startsWith('http') ? url : `https://${url}`;
        return `<a href="${href}" target="_blank" class="chat-link">${url}</a>`;
    });

    // Add Image if exists
    const imageHtml = msg.file_url ? `<img src="${msg.file_url}" class="chat-image" onclick="window.open(this.src)">` : "";

    bubble.innerHTML = `
        ${imageHtml}
        <div>${content}</div>
    `;
    chatBox.appendChild(bubble);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// 3. Handle Send
async function sendMessage() {
    const text = chatInput.value.trim();
    const file = fileInput.files[0];
    if (!text && !file) return;

    const token = localStorage.getItem("token");
    const fd = new FormData();
    fd.append("message", text);
    if (file) fd.append("imageFile", file); // Using your product-upload key

    try {
        const res = await fetch(`${API_BASE_URL}/api/messages`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}` },
            body: fd
        });

        if (res.ok) {
            const data = await res.json();
            renderMessage(data);
            
            // Clear inputs
            chatInput.value = "";
            fileInput.value = "";
            imagePreviewContainer.style.display = "none";
        }
    } catch (err) {
        console.error("Error sending:", err);
    }
}

chatSend.onclick = sendMessage;
chatInput.onkeypress = (e) => { if (e.key === "Enter") sendMessage(); };