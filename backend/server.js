import express      from "express";
import cors         from "cors";
import dotenv       from "dotenv";
import rateLimit    from "express-rate-limit";
import path         from "path";
import { fileURLToPath } from "url";
import { connectDB } from "./config/db.js";
import authRoutes        from "./routes/auth.js";
import carRoutes         from "./routes/cars.js";
import transactionRoutes from "./routes/transactions.js";
import adminRoutes       from "./routes/admin.js";
import chatbotRoutes     from "./routes/chatbot.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

/* ── CORS ─────────────────────────────────── */
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:5500,http://127.0.0.1:5500").split(",");
app.use(cors({
  origin: (origin, cb) => (!origin || allowedOrigins.includes(origin)) ? cb(null, true) : cb(new Error("CORS blocked")),
  methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"],
}));

/* ── BODY PARSING ─────────────────────────── */
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

/* ── RATE LIMITING ────────────────────────── */
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later." },
}));

/* ── ROUTES ───────────────────────────────── */
app.use("/auth",         authRoutes);
app.use("/cars",         carRoutes);
app.use("/transactions", transactionRoutes);
app.use("/admin",        adminRoutes);
app.use("/chat",         chatbotRoutes);

/* ── HEALTH CHECK ─────────────────────────── */
app.get("/health", (_req, res) => res.json({ status: "ok", ts: Date.now() }));

/* ── SERVE STATIC FRONTEND ────────────────── */
const frontendDir = path.join(__dirname, "..", "frontend");
app.use(express.static(frontendDir));
app.get("/{*path}", (_req, res) => res.sendFile(path.join(frontendDir, "index.html")));

/* ── GLOBAL ERROR HANDLER ─────────────────── */
app.use((err, _req, res, _next) => {
  console.error("[error]", err.message);
  res.status(err.status || 500).json({ message: err.message || "Internal server error" });
});

/* ── START ────────────────────────────────── */
const PORT = process.env.PORT || 3000;
connectDB()
  .then(() => app.listen(PORT, () =>
    console.log(`🚗  4Kautos server → http://localhost:${PORT}`)))
  .catch(err => { console.error("Startup failed:", err.message); process.exit(1); });

export default app;
