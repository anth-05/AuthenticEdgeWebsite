document.addEventListener("DOMContentLoaded", () => {
    const logoutButtons = document.querySelectorAll(".logout-link");
    
    logoutButtons.forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            
            // 1. Clear credentials
            localStorage.clear();
            sessionStorage.clear(); // Good practice to clear both
            
            // 2. Feedback (Optional but luxe)
            console.log("Admin session terminated.");
            
            // 3. Redirect
            window.location.replace("./login.html"); 
            // .replace is better for logout as it prevents the user 
            // from clicking the "Back" button to see the admin panel.
        });
    });
});