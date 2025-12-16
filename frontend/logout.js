  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    console.log("Setting up logout button");
    logoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      localStorage.clear();
      window.location.href = "index.html";
    });
  }
 