export function openModal(title, message, onConfirm) {
  const modal = document.getElementById("custom-modal");
  if (!modal) {
  console.error("❌ Modal HTML missing on this page");
  return;
}


  document.getElementById("modal-title").textContent = title;
  document.getElementById("modal-message").textContent = message;

  modal.classList.remove("hidden");

  const confirmBtn = document.getElementById("modal-confirm");
  const cancelBtn = document.getElementById("modal-cancel");

  confirmBtn.onclick = () => {
    modal.classList.add("hidden");
    onConfirm?.();
  };

  cancelBtn.onclick = () => {
    modal.classList.add("hidden");
  };
}
