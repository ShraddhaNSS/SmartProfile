const qs = (s) => document.querySelector(s);

/* Auth Elements */
const authContainer = qs("#authContainer");
const generatorContainer = qs("#generatorContainer");
const nameEl = qs("#name");
const emailEl = qs("#email");
const passwordEl = qs("#password");
const signupBtn = qs("#signupBtn");
const loginBtn = qs("#loginBtn");

/* Resume Elements */
const skillsEl = qs("#skills");
const roleEl = qs("#role");
const toneEl = qs("#tone");
const expEl = qs("#experience");
const lenEl = qs("#length");
const generateBtn = qs("#generateBtn");
const clearBtn = qs("#clearBtn");
const copyBtn = qs("#copyBtn");
const regenBtn = qs("#regenerateBtn");
const resultEl = qs("#result");
const resultContainer = qs("#resultContainer");
const loadingEl = qs("#loading");
const charCount = qs("#charCount");
const themeToggle = qs("#themeToggle");
const toast = qs("#toast");

const API_URL = "http://localhost:3000";
const MAX_INPUT = 500;
let token = localStorage.getItem("smartprofile:token") || "";

/* ------------------- AUTH ------------------- */
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 1800);
}

function showGenerator() {
  authContainer.classList.add("hidden");
  generatorContainer.classList.remove("hidden");
}

async function signup() {
  const payload = { name: nameEl.value.trim(), email: emailEl.value.trim(), password: passwordEl.value.trim() };
  if (!payload.name || !payload.email || !payload.password) { showToast("Fill all fields to sign up."); return; }

  try {
    const res = await fetch(`${API_URL}/auth/signup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok) { showToast(data.error || "Signup failed"); return; }

    token = data.token;
    localStorage.setItem("smartprofile:token", token);
    showGenerator();
    showToast("✅ Signed up successfully!");
  } catch (err) {
    console.error(err);
    showToast("Signup error");
  }
}

async function login() {
  const payload = { email: emailEl.value.trim(), password: passwordEl.value.trim() };
  if (!payload.email || !payload.password) { showToast("Enter email & password."); return; }

  try {
    const res = await fetch(`${API_URL}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok) { showToast(data.error || "Login failed"); return; }

    token = data.token;
    localStorage.setItem("smartprofile:token", token);
    showGenerator();
    showToast("✅ Logged in successfully!");
  } catch (err) {
    console.error(err);
    showToast("Login error");
  }
}

signupBtn.addEventListener("click", signup);
loginBtn.addEventListener("click", login);

/* ------------------- Resume Generator ------------------- */
function syncCount() { charCount.textContent = String(skillsEl.value.length); }
skillsEl.addEventListener("input", () => { if (skillsEl.value.length > MAX_INPUT) skillsEl.value = skillsEl.value.slice(0, MAX_INPUT); syncCount(); });

function setBusy(on) { generateBtn.disabled = on; regenBtn.disabled = on; loadingEl.classList.toggle("hidden", !on); }
function showResult(text) { resultEl.textContent = text.trim(); resultContainer.classList.remove("hidden"); }

async function generateSummary(params) {
  setBusy(true);
  resultContainer.classList.add("hidden");
  try {
    const res = await fetch(`${API_URL}/generate`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(params) });
    const data = await res.json();
    if (!res.ok) { showToast(data.error || "Generation failed"); return; }
    showResult(data.summary);
  } catch (err) { console.error(err); showToast("Server error"); }
  finally { setBusy(false); }
}

generateBtn.addEventListener("click", () => {
  const skills = skillsEl.value.trim();
  if (!skills) { showToast("Please enter your skills first."); skillsEl.focus(); return; }
  generateSummary({ skills, tone: toneEl.value, experience: expEl.value, length: Number(lenEl.value), role: roleEl.value.trim() });
});

regenBtn.addEventListener("click", () => generateBtn.click());

/* ------------------- Theme ------------------- */
(function initTheme() {
  const key = "smartprofile:theme";
  const saved = localStorage.getItem(key) || "light";
  if (saved === "dark") document.documentElement.classList.add("dark");
  themeToggle.textContent = saved === "dark" ? "☀️ Light" : "🌙 Dark";
  themeToggle.addEventListener("click", () => {
    document.documentElement.classList.toggle("dark");
    localStorage.setItem(key, document.documentElement.classList.contains("dark") ? "dark" : "light");
    themeToggle.textContent = document.documentElement.classList.contains("dark") ? "☀️ Light" : "🌙 Dark";
  });
})();

/* ------------------- Auto-show generator if token exists ------------------- */
if (token) showGenerator();
