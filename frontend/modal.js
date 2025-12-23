/**
 * Global Modal Controller
 * @param {string} title - The heading of the modal
 * @param {string} message - The body text
 * @param {function} onConfirm - Callback function for the "Action" button
 * @param {string} confirmText - Optional label for the confirm button
 */
export function openModal(title, message, onConfirm, confirmText = "Confirm") {
    const modal = document.getElementById("custom-modal");
    if (!modal) {
        console.error("❌ Modal HTML missing. Ensure <div id='custom-modal'> exists in your HTML.");
        return;
    }

    // 1. Set Content
    const titleEl = document.getElementById("modal-title");
    const messageEl = document.getElementById("modal-message");
    const confirmBtn = document.getElementById("modal-confirm");
    const cancelBtn = document.getElementById("modal-cancel");

    if (titleEl) titleEl.textContent = title;
    if (messageEl) messageEl.textContent = message;
    if (confirmBtn) confirmBtn.textContent = confirmText;

    // 2. Show Modal (using flex for perfect centering)
    modal.style.display = "flex";
    modal.classList.add("modal-active");

    // 3. Define Actions
    const closeModal = () => {
        modal.style.display = "none";
        modal.classList.remove("modal-active");
        // Remove event listeners to prevent memory leaks or double triggers
        confirmBtn.onclick = null;
        cancelBtn.onclick = null;
    };

    confirmBtn.onclick = () => {
        closeModal();
        if (onConfirm) onConfirm();
    };

    cancelBtn.onclick = closeModal;

    // 4. Click Outside to Close
    modal.onclick = (e) => {
        if (e.target === modal) closeModal();
    };
}