import express       from 'express';
import cors          from 'cors';
import dotenv        from 'dotenv';
import rateLimit     from 'express-rate-limit';
import path          from 'path';
import fs            from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { connectDB } from './config/db.js';
import { securityHeaders } from './middleware/security.js';
import authRoutes        from './routes/auth.js';
import carRoutes         from './routes/cars.js';
import transactionRoutes from './routes/transactions.js';
import adminRoutes       from './routes/admin.js';
import chatbotRoutes     from './routes/chatbot.js';
import fxRoutes          from './routes/fx.js';
import clearanceRoutes   from './routes/clearance.js';
import subscribeRoutes   from './routes/subscribe.js';
import messageRoutes     from './routes/messages.js';
import vinRoutes         from './routes/vin.js';
import uploadRoutes      from './routes/uploads.js';

dotenv.config();

// Fail fast in production if the JWT secret is missing or weak.
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  const msg = 'JWT_SECRET is missing or shorter than 32 characters';
  if (process.env.NODE_ENV === 'production') throw new Error(msg);
  console.warn(`⚠️  ${msg} — set a strong secret in .env before deploying.`);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.disable('x-powered-by');
app.use(securityHeaders);

/* ── CORS ─────────────────────────────────── */
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5500,http://127.0.0.1:5500,http://localhost:3000')
  .split(',').map(o => o.trim()).filter(Boolean);
const isProd = process.env.NODE_ENV === 'production';

// Same-origin / curl requests have no Origin and are always allowed. In dev we also
// accept any localhost / 127.0.0.1 origin (any port) and file:// pages (Origin "null"),
// so the frontend works however it's served. Production is restricted to ALLOWED_ORIGINS.
function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  if (isProd) return false;
  if (origin === 'null') return true; // file:// (double-clicked HTML)
  try {
    const { hostname } = new URL(origin);
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
  } catch {
    return false;
  }
}

app.use(cors({
  origin: (origin, cb) => isAllowedOrigin(origin) ? cb(null, true) : cb(new Error('CORS blocked')),
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  exposedHeaders: ['X-Total-Count','X-Total-Pages'],
}));

/* ── BODY PARSING ─────────────────────────── */
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

/* ── RATE LIMITING ────────────────────────── */
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
}));

/* ── ROUTES ───────────────────────────────── */
app.use('/auth',         authRoutes);
app.use('/cars',         carRoutes);
app.use('/transactions', transactionRoutes);
app.use('/admin',        adminRoutes);
app.use('/chat',         chatbotRoutes);
app.use('/fx',           fxRoutes);
app.use('/clearance',    clearanceRoutes);
app.use('/subscribe',    subscribeRoutes);
app.use('/messages',     messageRoutes);
app.use('/vin',          vinRoutes);

/* ── HEALTH CHECK ─────────────────────────── */
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: Date.now() }));

/* ── UPLOADS: serve (immutable, CDN-ready) + accept ── */
const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });
// Filenames are content-hashed, so cache aggressively — put a CDN in front in prod.
app.use('/uploads', express.static(uploadsDir, { immutable: true, maxAge: '365d' }));
app.use('/uploads', uploadRoutes); // POST / (static above only answers GET/HEAD)

/* ── SERVE STATIC FRONTEND ────────────────── */
const frontendDir = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendDir));
app.get('/{*path}', (_req, res) => res.sendFile(path.join(frontendDir, 'index.html')));

/* ── GLOBAL ERROR HANDLER ─────────────────── */
app.use((err, _req, res, _next) => {
  console.error('[error]', err.message);
  const status = err.status || err.statusCode || 500;
  // Don't leak internal error text on 5xx; client (4xx) messages are safe to show.
  res.status(status).json({ message: status >= 500 ? 'Internal server error' : (err.message || 'Request error') });
});

export default app;

/* ── START (skipped when imported by tests) ── */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const PORT = process.env.PORT || 3000;
  connectDB()
    .then(() => app.listen(PORT, () =>
      console.log(`🚗  4Kautos server → http://localhost:${PORT}`)))
    .catch(err => { console.error('Startup failed:', err.message); process.exit(1); });
}
