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

    // 2. Hero Background Slideshow (crossfade between two stacked layers)
    const heroLayers = document.querySelectorAll(".hero-bg-layer");
    const images = [
        'images/Homepage-Image.jpg',
        'images/image1.png',
        'images/image2.png',
        'images/image3.png'
    ];

    if (heroLayers.length === 2) {
        let activeLayer = 0;
        let nextIndex = 1;

        // Preload so the crossfade never reveals a blank/half-loaded frame
        images.forEach(src => { new Image().src = src; });

        heroLayers[0].style.backgroundImage = `url('${images[0]}')`;

        function crossfade() {
            const incoming = heroLayers[activeLayer === 0 ? 1 : 0];
            incoming.style.backgroundImage = `url('${images[nextIndex]}')`;
            heroLayers[activeLayer].classList.remove("active");
            incoming.classList.add("active");
            activeLayer = activeLayer === 0 ? 1 : 0;
            nextIndex = (nextIndex + 1) % images.length;
        }

        setInterval(crossfade, 6000);
    }

    // 3. Reveal-on-scroll for sections/cards
    const revealTargets = document.querySelectorAll(".reveal");
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (revealTargets.length) {
        if (prefersReducedMotion || !("IntersectionObserver" in window)) {
            revealTargets.forEach(el => el.classList.add("is-visible"));
        } else {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add("is-visible");
                        observer.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.15 });

            revealTargets.forEach(el => observer.observe(el));
        }
    }
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