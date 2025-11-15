const socket = io("https://your-render-backend.onrender.com");

const userId = localStorage.getItem("user_id");
const chatBox = document.getElementById("chatBox");
const chatInput = document.getElementById("chatInput");
const chatSendBtn = document.getElementById("chatSend");
const chatFileInput = document.getElementById("chatFile");
const chatWidget = document.querySelector('.chat-widget');
const chatToggleBtn = document.querySelector('.chat-toggle-btn');

if (chatToggleBtn && chatWidget) {
  chatToggleBtn.addEventListener('click', () => {
    chatWidget.classList.toggle('open');
  });
}

// Function to append a message bubble to chat
function addMessage(message, sender) {
  const messageDiv = document.createElement("div");
  messageDiv.className = `message ${sender}-msg`;
  messageDiv.textContent = message;
  chatBox.appendChild(messageDiv);
  chatBox.scrollTop = chatBox.scrollHeight; // scroll to bottom
}

// Send message function
async function sendMessage() {
  const message = chatInput.value.trim();
  if (!message) return;

  socket.emit("sendMessage", {
    user_id: userId,
    sender: "user",
    message: message,
    file_url: null,
    timestamp: new Date().toISOString(),
  });

  chatInput.value = "";
}

// Event listeners
chatSendBtn.addEventListener("click", sendMessage);
chatInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
});
chatFileInput.addEventListener("change", () => {
  alert("File upload is not implemented yet.");
});

// Listen for server messages addressed to this user
socket.on(`message_${userId}`, (msg) => {
  if (msg.message) addMessage(msg.message, msg.sender);
});
