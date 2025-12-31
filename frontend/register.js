import { API_BASE_URL } from "./config.js";

document.addEventListener("DOMContentLoaded", () => {
    const registerForm = document.getElementById("register-form");
    if (registerForm) {
        registerForm.addEventListener("submit", handleRegister);
    }
});

async function handleRegister(e) {
    e.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();
    const submitBtn = document.getElementById("registerBtn");
    const feedback = document.getElementById("register-feedback");

    if (feedback) feedback.textContent = "";

    // 1. Validation
    if (!email || !password) {
        showFeedback("Please provide both email and password.");
        return;
    }

    if (password.length < 6) {
        showFeedback("Security requirement: Password must be at least 6 characters.");
        return;
    }

    try {
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerText = "Processing Application...";
        }

        // 2. API Call
        const res = await fetch(`${API_BASE_URL}/api/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                email, 
                password, 
                role: "user" 
            })
        });

        const data = await res.json();

        if (res.ok) {
            // SUCCESS: Updated message to include email confirmation notice
            showFeedback("Membership created. A confirmation email has been sent.", "success");
            
            // Increased timeout to 3 seconds so users can read the email notice
            setTimeout(() => {
                window.location.replace("login.html");
            }, 3000);
        } else {
            showFeedback(data.error || "Registration encountered an issue.");
        }
    } catch (err) {
        console.error("Registration Error:", err);
        showFeedback("Connection error. Please try again.");
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = "Create Account";
        }
    }
}

// Optimized helper function for "Authentic Edge" styling
function showFeedback(message, type = "error") {
    const feedback = document.getElementById("register-feedback");
    if (feedback) {
        // Applying more premium styling via JS
        feedback.style.fontSize = "12px";
        feedback.style.textTransform = "uppercase";
        feedback.style.letterSpacing = "0.1em";
        feedback.style.textAlign = "center";
        feedback.style.marginTop = "15px";
        feedback.style.fontWeight = "600";
        
        // Solid black for success (brand-aligned) or red for error
        feedback.style.color = type === "success" ? "#000" : "#d00000";
        feedback.textContent = message;
    } else {
        alert(message);
    }
}