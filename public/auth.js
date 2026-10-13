
const authView = document.getElementById("authView");
const chatView = document.getElementById("chatView");
const authStatus = document.getElementById("authStatus");

function showAuthForm(formName) {
  document.getElementById("loginForm").hidden = formName !== "login";
  document.getElementById("registerForm").hidden = formName !== "register";
  document.getElementById("verifyForm").hidden = formName !== "verify";

  authStatus.textContent = "";
  authStatus.className = "status-message";
}

function setAuthStatus(message, success = false) {
  authStatus.textContent = message;
  authStatus.className = success
    ? "status-message success"
    : "status-message";
}

function showChatApp() {
  authView.hidden = true;
  chatView.hidden = false;

  if (typeof initChatApp === "function") {
    initChatApp();
  }
}

function showLoginApp() {
  chatView.hidden = true;
  authView.hidden = false;
  showAuthForm("login");
}

document.getElementById("showRegister").addEventListener("click", () => {
  showAuthForm("register");
});

document.getElementById("showLogin").addEventListener("click", () => {
  showAuthForm("login");
});

document.getElementById("backToLogin").addEventListener("click", () => {
  showAuthForm("login");
});

document.getElementById("register").addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = document.getElementById("registerName").value.trim();
  const email = document.getElementById("registerEmail").value.trim();
  const password = document.getElementById("registerPassword").value;

  const button = event.submitter;
  button.disabled = true;
  setAuthStatus("Creating your account...");

  try {
    await apiRequest("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password })
    });

    document.getElementById("verifyEmail").value = email;
    showAuthForm("verify");
    setAuthStatus("Account created. Check your email for the OTP.", true);
  } catch (error) {
    setAuthStatus(error.message);
  } finally {
    button.disabled = false;
  }
});

document.getElementById("verify").addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = document.getElementById("verifyEmail").value.trim();
  const otp = document.getElementById("otp").value.trim();
  const button = event.submitter;

  button.disabled = true;
  setAuthStatus("Verifying your email...");

  try {
    await apiRequest("/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({ email, otp })
    });

    showAuthForm("login");
    setAuthStatus("Email verified. You can now sign in.", true);
  } catch (error) {
    setAuthStatus(error.message);
  } finally {
    button.disabled = false;
  }
});

document.getElementById("login").addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  const button = event.submitter;

  button.disabled = true;
  setAuthStatus("Signing you in...");

  try {
    const result = await apiRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });

    const payload = getPayload(result);
    const accessToken = payload.accessToken || result.accessToken;

    if (!accessToken) {
      throw new Error("Login succeeded but no access token was returned.");
    }

    sessionStorage.setItem("accessToken", accessToken);

    const user = payload.user || result.user;

    if (user) {
      sessionStorage.setItem("currentUser", JSON.stringify(user));
    }

    showChatApp();
  } catch (error) {
    setAuthStatus(error.message);
  } finally {
    button.disabled = false;
  }
});

document.getElementById("logout").addEventListener("click", () => {
  sessionStorage.removeItem("accessToken");
  sessionStorage.removeItem("currentUser");

  if (typeof disconnectChat === "function") {
    disconnectChat();
  }

  showLoginApp();
});

if (sessionStorage.getItem("accessToken")) {
  showChatApp();
} else {
  showAuthForm("login");
}