import { API_BASE_URL } from "./config.js";
import { openModal } from "./modal.js"; // Adjust path if needed

document.addEventListener("DOMContentLoaded", () => {
    // Check if the user has already seen the popup this session (optional)
    if (!sessionStorage.getItem("announcementSeen")) {
        
        openModal(
            "Archive Update", 
            "Please note: Our digital vault is currently being synced. Not all physical stock has been listed yet. We are adding new pieces daily—thank you for your patience as we curate the collection. Explore what's live now.",
            () => {
                console.log("User acknowledged stock update.");
                sessionStorage.setItem("announcementSeen", "true");
            },
            "Enter Archives"
        );
    }
});
async function loadHomepageProducts() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/products`);
        const allProducts = await res.json();

        // 1. New Arrivals (Top 4 latest)
        const newArrivals = allProducts.slice(0, 4);
        renderGrid(document.getElementById('featured-product-grid'), newArrivals);

        // 2. Most Wanted (Filtered by your admin choice)
        const mostWanted = allProducts.filter(p => p.is_most_wanted === true);
        renderGrid(document.getElementById('most-wanted-grid'), mostWanted);
    } 
    catch (err) {
        console.error("Error loading grids:", err);
    }
}

// Re-usable render function to keep your code clean
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
document.addEventListener("DOMContentLoaded", () => {
    const heroOverlay = document.querySelector(".hero-bg-overlay");
    
    // List your slideshow images here
    const images = [
        'images/Homepage-Image.jpg',
        'images/image1.png',
        'images/image2.png',
        'images/image3.png'
    ];

    let currentIndex = 0;

    function changeBackground() {
        // Apply the new image
        heroOverlay.style.backgroundImage = `url('${images[currentIndex]}')`;
        
        // Increment index, or reset to 0 if at the end
        currentIndex = (currentIndex + 1) % images.length;
    }

    // Set initial image
    changeBackground();

    // Change image every 5 seconds (5000ms)
    setInterval(changeBackground, 10000);
});
document.addEventListener("DOMContentLoaded", loadHomepageProducts);