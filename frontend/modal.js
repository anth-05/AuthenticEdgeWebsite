export function openModal(title, message, onConfirm) {
  const modal = document.getElementById("modal");
  const titleEl = modal.querySelector(".modal-title");
  const messageEl = modal.querySelector(".modal-message");
  const confirmBtn = modal.querySelector(".modal-confirm");
  const cancelBtn = modal.querySelector(".modal-cancel");

  titleEl.textContent = title;
  messageEl.textContent = message;

  modal.classList.add("show");

  confirmBtn.onclick = () => {
    modal.classList.remove("show");
    onConfirm?.();
  };

  cancelBtn.onclick = () => {
    modal.classList.remove("show");
  };
}
