import { API_BASE_URL } from "./config.js";
import { openModal } from "./modal.js";

document.addEventListener("DOMContentLoaded", () => {
    const cards = document.querySelectorAll(".sub-card");

    cards.forEach(card => {
        card.addEventListener("click", async () => {
            const plan = card.dataset.plan;
            const token = localStorage.getItem("token");

            // 1. Check Authentication
            if (!token) {
                openModal(
                    "Membership Required",
                    "To access our exclusive tiers, please sign in or create an account.",
                    () => window.location.href = "login.html",
                    "Sign In"
                );
                return;
            }

            try {
                // 2. Fetch Current Subscription Status
                const res = await fetch(`${API_BASE_URL}/api/subscription`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (!res.ok) throw new Error("Subscription sync failed");

                const sub = await res.json();

                // 3. Logic: If user already has a pending or active plan
                if (sub.status !== "none" && sub.status !== "rejected") {
                    openModal(
                        "Application Active",
                        `You currently have a status of "${sub.status}" for the ${sub.current_plan || sub.requested_plan} tier. View details in your account?`,
                        () => window.location.href = "user-dashboard.html",
                        "Go to Account"
                    );
                    return;
                }

                // 4. Logic: Allow New Request
                openModal(
                    "Confirm Selection",
                    `Would you like to apply for the ${plan} membership tier? Our concierge team will review your request.`,
                    async () => {
                        const createRes = await fetch(`${API_BASE_URL}/api/subscription/request`, {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                Authorization: `Bearer ${token}`
                            },
                            body: JSON.stringify({ plan })
                        });

                        if (createRes.ok) {
                            openModal(
                                "Request Transmitted",
                                "Your membership application has been sent to our team. You can track the status in your dashboard.",
                                () => window.location.href = "user-dashboard.html",
                                "View Status"
                            );
                        } else {
                            alert("Transmission error. Please try again later.");
                        }
                    },
                    "Apply Now"
                );

            } catch (err) {
                console.error("❌ Subscription error:", err);
            }
        });
    });
});