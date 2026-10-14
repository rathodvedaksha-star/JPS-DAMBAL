
import { createClient } from
    "https://esm.sh/@supabase/supabase-js@2";

// Replace these with your own Supabase project details
const SUPABASE_URL = "https://tjybrmumnxulnqxpsxhi.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1APbA6E1TJaD0iWNIxojwQ_7fPG3LT7";

const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);

// Mobile navigation menu
const menuToggle = document.getElementById("menuToggle");
const navLinks = document.getElementById("navLinks");

menuToggle.addEventListener("click", () => {
    navLinks.classList.toggle("active");

    const isOpen = navLinks.classList.contains("active");

    menuToggle.textContent = isOpen ? "✕" : "☰";
    menuToggle.setAttribute("aria-expanded", String(isOpen));
});

document.querySelectorAll(".nav-links a").forEach(link => {
    link.addEventListener("click", () => {
        navLinks.classList.remove("active");
        menuToggle.textContent = "☰";
        menuToggle.setAttribute("aria-expanded", "false");
    });
});

// Current year
document.getElementById("year").textContent =
    new Date().getFullYear();

// Save school enquiries to Supabase
const contactForm = document.getElementById("contactForm");
const formMessage = document.getElementById("formMessage");
const submitButton = contactForm.querySelector('button[type="submit"]');

contactForm.addEventListener("submit", async event => {
    event.preventDefault();

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const subject = document.getElementById("subject").value;
    const message = document.getElementById("message").value.trim();

    if (
        !name || !email || !phone ||
        !subject || !message
    ) {
        formMessage.textContent = "Please fill in all fields.";
        formMessage.style.color = "#b42318";
        return;
    }

    if (
        SUPABASE_URL.includes("YOUR_SUPABASE") ||
        SUPABASE_PUBLISHABLE_KEY.includes("YOUR_SUPABASE")
    ) {
        formMessage.textContent =
            "Please configure your Supabase URL and publishable key.";
        formMessage.style.color = "#b42318";
        return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Sending...";
    formMessage.textContent = "";

    try {
        const { error } = await supabase
            .from("school_enquiries")
            .insert([
                {
                    name,
                    email,
                    phone,
                    subject,
                    message
                }
            ]);

        if (error) {
            throw error;
        }

        formMessage.textContent =
            "Thank you! Your enquiry was submitted successfully.";
        formMessage.style.color = "#18794e";

        contactForm.reset();

    } catch (error) {
        console.error("Supabase error:", error);

        formMessage.textContent =
            "Unable to submit your enquiry. Please try again.";
        formMessage.style.color = "#b42318";

    } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Send Enquiry";
    }
});
// JPS Hero Automatic Photo Slideshow
const heroSection = document.querySelector(".hero");

if (heroSection) {
    const heroPhotos = [
        "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1800&q=85",
        "https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=1800&q=85",
        "https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?auto=format&fit=crop&w=1800&q=85"
    ];

    let currentHeroPhoto = 0;

    setInterval(() => {
        currentHeroPhoto =
            (currentHeroPhoto + 1) % heroPhotos.length;

        heroSection.style.backgroundImage = `
            linear-gradient(
                90deg,
                rgba(5, 25, 55, 0.88),
                rgba(5, 25, 55, 0.35)
            ),
            url("${heroPhotos[currentHeroPhoto]}")
        `;
    }, 5000);
}
