document.addEventListener("DOMContentLoaded", function() {
  // Load products after DOM ready
  async function loadProducts() {
    const res = await fetch("https://authenticedgewebsite.onrender.com/api/products");
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

  loadProducts();
});
