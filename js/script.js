// Wait for the DOM to fully load
document.addEventListener("DOMContentLoaded", () => {
    // Add a class to the body to trigger the CSS fade-in transition
    document.body.classList.add("loaded");
    
    console.log("Document Repository initialized successfully!");
});
