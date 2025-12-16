export function openModal(title, message, onConfirm) {
  const modal = document.getElementById("modal");

  if (!modal) {
    alert(message);
    return;
  }

  modal.querySelector(".modal-title").textContent = title;
  modal.querySelector(".modal-message").textContent = message;

  modal.classList.add("show");

  modal.querySelector(".confirm").onclick = () => {
    modal.classList.remove("show");
    onConfirm?.();
  };

  modal.querySelector(".cancel").onclick = () => {
    modal.classList.remove("show");
  };
}
