import { API_BASE_URL } from "./config.js";

document.addEventListener("DOMContentLoaded", () => {
    // MATCHED ID: register-form (dash-case to match HTML)
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

    // Clear previous feedback
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
        // UI Feedback
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
            // Success
            showFeedback("Membership created. Welcome.", "success");
            setTimeout(() => {
                window.location.replace("login.html");
            }, 1500);
        } else {
            // Server Error
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

// Helper function to handle the UI feedback div
function showFeedback(message, type = "error") {
    const feedback = document.getElementById("register-feedback");
    if (feedback) {
        feedback.style.color = type === "success" ? "#155724" : "#d00000";
        feedback.textContent = message;
    } else {
        alert(message); // Fallback if div is missing
    }
}