import { initTheme } from "./ui.js";
initTheme();
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
