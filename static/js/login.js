// login.js — password show/hide toggle and submit-loading state for /login

(function () {
    const toggle = document.getElementById("password-toggle");
    const passwordInput = document.getElementById("password");
    if (toggle && passwordInput) {
        const eyeIcon = toggle.querySelector(".icon-eye");
        const eyeOffIcon = toggle.querySelector(".icon-eye-off");
        toggle.addEventListener("click", () => {
            const showing = passwordInput.type === "password";
            passwordInput.type = showing ? "text" : "password";
            eyeIcon.hidden = showing;
            eyeOffIcon.hidden = !showing;
            toggle.setAttribute("aria-label", showing ? "Hide password" : "Show password");
        });
    }

    const form = document.getElementById("login-form");
    const submitBtn = document.getElementById("login-submit");
    if (form && submitBtn) {
        form.addEventListener("submit", () => {
            submitBtn.disabled = true;
            submitBtn.querySelector(".login-submit-label").hidden = true;
            submitBtn.querySelector(".login-submit-loading").hidden = false;
        });
    }
})();
