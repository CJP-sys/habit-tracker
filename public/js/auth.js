import { initTheme, toast } from "./ui.js";
import {
  createAccountWithEmail,
  friendlyAuthError,
  getCurrentUser,
  sendPasswordReset,
  signInWithEmail,
} from "./firebase.js";
initTheme();
getCurrentUser().then((user) => {
  if (user) location.replace("dashboard.html");
});
const loginTab = document.querySelector("#login-tab"),
  signupTab = document.querySelector("#signup-tab"),
  form = document.querySelector("#auth-form");
let mode = location.hash === "#signup" ? "signup" : "login";
function setMode(next) {
  mode = next;
  const signup = mode === "signup";
  loginTab.setAttribute("aria-selected", String(!signup));
  signupTab.setAttribute("aria-selected", String(signup));
  document
    .querySelectorAll(".signup-only")
    .forEach((el) => (el.hidden = !signup));
  document
    .querySelectorAll(".login-only")
    .forEach((el) => (el.hidden = signup));
  document.querySelector("#auth-title").textContent = signup
    ? "Create your account"
    : "Welcome back";
  document.querySelector("#auth-subtitle").textContent = signup
    ? "Start small. Build something lasting."
    : "Continue building the routines that matter.";
  document.querySelector("#submit-label").textContent = signup
    ? "Create account"
    : "Log in";
  document.querySelector("#password").autocomplete = signup
    ? "new-password"
    : "current-password";
  history.replaceState(null, "", signup ? "#signup" : "#login");
}
loginTab.addEventListener("click", () => setMode("login"));
signupTab.addEventListener("click", () => setMode("signup"));
setMode(mode);
document
  .querySelector("#toggle-password")
  .addEventListener("click", (event) => {
    const input = document.querySelector("#password");
    input.type = input.type === "password" ? "text" : "password";
    event.currentTarget.textContent =
      input.type === "password" ? "Show" : "Hide";
  });
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = document.querySelector("#email"),
    password = document.querySelector("#password"),
    submit = form.querySelector('[type="submit"]');
  document.querySelector("#email-error").textContent = email.validity.valid
    ? ""
    : "Enter a valid email address.";
  document.querySelector("#password-error").textContent =
    password.value.length >= 8 ? "" : "Use at least 8 characters.";
  if (!email.validity.valid || password.value.length < 8) return;
  submit.disabled = true;
  try {
    if (mode === "signup")
      await createAccountWithEmail(
        email.value,
        password.value,
        document.querySelector("#name").value,
      );
    else await signInWithEmail(email.value, password.value);
    location.replace("dashboard.html");
  } catch (error) {
    toast("Unable to continue", friendlyAuthError(error), "error");
    submit.disabled = false;
  }
});
document
  .querySelector("#forgot-password")
  .addEventListener("click", async () => {
    const email = document.querySelector("#email").value;
    if (!email) {
      toast(
        "Enter your email",
        "Then select forgot password again.",
        "warning",
      );
      return;
    }
    try {
      await sendPasswordReset(email);
      toast("Reset link sent", "Check your inbox.");
    } catch (error) {
      toast("Unable to send reset link", friendlyAuthError(error), "error");
    }
  });
