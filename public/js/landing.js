import { initTheme } from "./ui.js";
initTheme();
const menuToggle = document.querySelector(".mobile-nav-toggle");
const navigation = document.querySelector("#site-navigation");

function closeNavigation() {
  menuToggle.setAttribute("aria-expanded", "false");
  menuToggle.setAttribute("aria-label", "Open navigation");
  navigation.classList.remove("open");
}

menuToggle.addEventListener("click", () => {
  const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
  menuToggle.setAttribute("aria-expanded", String(!isOpen));
  menuToggle.setAttribute("aria-label", isOpen ? "Open navigation" : "Close navigation");
  navigation.classList.toggle("open", !isOpen);
});

navigation.querySelectorAll("a").forEach((link) =>
  link.addEventListener("click", closeNavigation),
);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeNavigation();
});

const observer = new IntersectionObserver(
  (entries) =>
    entries.forEach((entry) => {
      if (entry.isIntersecting) entry.target.classList.add("visible");
    }),
  { threshold: 0.12 },
);
document
  .querySelectorAll(".reveal,.feature-card,.steps li")
  .forEach((item) => observer.observe(item));
