import { API_BASE_URL } from "./config.js";
import { openModal } from "./modal.js"; 

document.addEventListener("DOMContentLoaded", () => {
    // 1. Stock Update Modal
    if (!sessionStorage.getItem("announcementSeen")) {
        openModal(
            "Stock Update", 
            "Please note: Our stock is still being added. Not all physical stock has been listed yet. We are adding new pieces daily—thank you for your patience as we curate the collection. Explore what's live now!!",
            () => {
                sessionStorage.setItem("announcementSeen", "true");
            },
            "Enter Archives"
        );
    }

    // 2. Hero Background Slideshow
    const heroOverlay = document.querySelector(".hero-bg-overlay");
    const images = [
        'images/Homepage-Image.jpg',
        'images/image1.png',
        'images/image2.png',
        'images/image3.png'
    ];
    let currentIndex = 0;

    function changeBackground() {
        if (!heroOverlay) return;
        heroOverlay.style.backgroundImage = `url('${images[currentIndex]}')`;
        currentIndex = (currentIndex + 1) % images.length;
    }

    changeBackground();
    setInterval(changeBackground, 10000);
});

// 3. Load Products
async function loadHomepageProducts() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/products`);
        const allProducts = await res.json();

        const newArrivals = allProducts.slice(0, 4);
        renderGrid(document.getElementById('featured-product-grid'), newArrivals);

        const mostWanted = allProducts.filter(p => p.is_most_wanted === true);
        renderGrid(document.getElementById('most-wanted-grid'), mostWanted);
    } 
    catch (err) {
        console.error("Error loading grids:", err);
    }
}

function renderGrid(container, productList) {
    if (!container) return;
    if (productList.length === 0) {
        container.innerHTML = "<div class='empty-msg'>Selection arriving soon.</div>";
        return;
    }

    container.innerHTML = productList.map(p => `
        <div class="product-card">
            <a href="single-product.html?id=${p.id}">
                <div class="product-img-frame">
                    <img src="${p.image}" alt="${p.name}">
                </div>
                <div class="product-details">
                    <h3>${p.name}</h3>
                    <p class="product-meta">${p.quality || 'Archive'}</p>
                </div>
            </a>
        </div>
    `).join("");
}

document.addEventListener("DOMContentLoaded", loadHomepageProducts);