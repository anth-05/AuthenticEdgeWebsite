document.addEventListener("DOMContentLoaded", () => {
  const logoutBtns = document.querySelectorAll("#logout-btn, .logout-link");

  function logout() {
    localStorage.clear();
    window.location.href = "login.html";
  }

  logoutBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      logout();
    });
  });
});
