document.addEventListener("DOMContentLoaded", function() {
  const menuToggle = document.querySelector(".menu-toggle");
  const navMenu = document.querySelector(".nav-menu");

  menuToggle.addEventListener("click", () => {
    navMenu.classList.toggle("active");
    menuToggle.classList.toggle("open");
  });
});

async function loadProducts() {
  const res = await fetch("http://localhost:5000/api/products");
  const products = await res.json();

  const productContainer = document.querySelector(".product-container");
  productContainer.innerHTML = "";

  products.forEach(p => {
    const div = document.createElement("div");
    div.classList.add("product");
    div.setAttribute("data-id", p.id);
    div.innerHTML = `
      <img src="${p.image}" alt="${p.name}">
      <h3>${p.name}</h3>
      <p>${p.availability}</p>
    `;
    productContainer.appendChild(div);
  });
}

document.addEventListener("DOMContentLoaded", loadProducts);
