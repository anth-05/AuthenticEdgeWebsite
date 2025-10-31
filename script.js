document.addEventListener("DOMContentLoaded", function() {
  const menuToggle = document.querySelector(".menu-toggle");
  const navMenu = document.querySelector(".nav-menu");

  menuToggle.addEventListener("click", () => {
    navMenu.classList.toggle("active");
    menuToggle.classList.toggle("open");
  });
});



// === PRODUCT DATA ===
const products = [
  {
    id: "1",
    name: "Classic Basketball Shoes",
    image: "./images/shoe1.jpg",
    gender: "Unisex",
    quality: ["Premium", "Good", "Normal"],
    availability: "In Stock",
  },
  {
    id: "2",
    name: "Urban Runner",
    image: "./images/shoe2.jpg",
    gender: "Men",
    quality: ["Premium", "Normal"],
    availability: "Limited Stock",
  },
  {
    id: "3",
    name: "Street Pro X",
    image: "./images/shoe3.jpg",
    gender: "Women",
    quality: ["Premium", "Good"],
    availability: "In Stock",
  }
];

// === CLICK PRODUCT TO VIEW DETAILS ===
if (window.location.pathname.includes("shop.html")) {
  document.querySelectorAll(".product").forEach(product => {
    product.addEventListener("click", () => {
      const productId = product.getAttribute("data-id");
      const selectedProduct = products.find(p => p.id === productId);

      if (selectedProduct) {
        localStorage.setItem("selectedProduct", JSON.stringify(selectedProduct));
        window.location.href = "product.html";
      }
    });
  });
}

// === LOAD DETAILS ON PRODUCT PAGE ===
if (window.location.pathname.includes("product.html")) {
  document.addEventListener("DOMContentLoaded", () => {
    const product = JSON.parse(localStorage.getItem("selectedProduct"));
    if (!product) return;

    document.getElementById("product-image").src = product.image;
    document.getElementById("product-name").textContent = product.name;
    document.getElementById("product-gender").textContent = product.gender;
    document.getElementById("product-availability").textContent = product.availability;

    const qualitySelect = document.getElementById("product-quality");
    product.quality.forEach(q => {
      const option = document.createElement("option");
      option.textContent = q;
      qualitySelect.appendChild(option);
    });
  });
}
