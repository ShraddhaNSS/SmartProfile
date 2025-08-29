import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Resume from "./models/Resume.js";
import User from "./models/User.js";

/* --- MongoDB connection --- */
mongoose
  .connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/smartprofile", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

const app = express();

/* --- Security & basics --- */
app.use(helmet({ crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" } }));
app.use(cors({ origin: "*", credentials: false })); // For testing, allow all origins
app.use(express.json({ limit: "1mb" }));

const limiter = rateLimit({ windowMs: 60 * 1000, limit: 60 });
app.use(limiter);

/* --- Utilities --- */
const sanitize = (s) => String(s || "").replace(/[<>]/g, "").trim();
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const JWT_SECRET = process.env.JWT_SECRET || "@shraddha003santosh077nevase223_love_smartprofile";

/* --- Auth middleware --- */
const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
};

/* --- Routes --- */
// Signup
app.post("/auth/signup", async (req, res) => {
  console.log("Signup payload:", req.body);
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: "Missing fields" });

  try {
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ error: "User already exists" });

    const hash = await bcrypt.hash(password, 10);
    const newUser = await User.create({ name, email, password: hash });
    const token = jwt.sign({ id: newUser._id, email }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, name: newUser.name, email: newUser.email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Signup failed" });
  }
});

// Login
app.post("/auth/login", async (req, res) => {
  console.log("Login payload:", req.body);
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Missing fields" });

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: "Invalid credentials" });

    const token = jwt.sign({ id: user._id, email }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, name: user.name, email: user.email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
});

// Generate resume summary
app.post("/generate", auth, async (req, res) => {
  try {
    const { skills = "", tone = "professional", experience = "student", length = 4, role = "" } = req.body;
    const cleanSkills = sanitize(skills).slice(0, 500);
    const cleanRole = sanitize(role).slice(0, 80);
    const cleanLen = clamp(Number(length) || 4, 2, 6);

    if (!cleanSkills) return res.status(400).json({ error: "Please provide skills." });

    const sys = `
      You are an expert resume writer.
      Write a tight, results-focused resume summary in US English.
      Avoid buzzwords, avoid fluff, avoid first-person pronouns.
      Include credible specifics (skills, domains, tools) and quantified impact when possible.
      No more than one line per sentence; no bullet points.
    `;

    const userPrompt = `
      Skills & facts: ${cleanSkills}.
      ${cleanRole ? `Target role: ${cleanRole}.` : ""}
      Tone: ${tone}.
      Experience level: ${experience}.
      Length: ${cleanLen} sentences.
      Return ONLY the summary text, nothing else.
    `;

    const ollamaResp = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "llama3", prompt: `${sys}\n\n${userPrompt}`, stream: false }),
    });

    if (!ollamaResp.ok) {
      const errorText = await ollamaResp.text();
      return res.status(502).json({ error: "Ollama request failed", details: errorText });
    }

    const data = await ollamaResp.json();
    const text = data.response?.trim();
    if (!text) return res.status(502).json({ error: "Empty response from Ollama." });

    const newResume = new Resume({ user: req.user.id, skills: cleanSkills, role: cleanRole, tone, experience, length: cleanLen, summary: text });
    await newResume.save();

    res.json({ summary: text });
  } catch (err) {
    console.error("Error /generate:", err);
    res.status(500).json({ error: "Generation failed" });
  }
});

// Get all resumes
app.get("/resumes", auth, async (req, res) => {
  try {
    const resumes = await Resume.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.json(resumes);
  } catch (err) {
    console.error("Error /resumes:", err);
    res.status(500).json({ error: "Failed to fetch resumes" });
  }
});

/* --- Start server --- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));
