document.addEventListener("DOMContentLoaded", () => {
  const path = window.location.pathname.split("/").pop();

  document.querySelectorAll(".bottom-tabs a").forEach(link => {
    const linkPath = link.getAttribute("href");

    if (linkPath === path) {
      link.classList.add("active");
    }
  });
});