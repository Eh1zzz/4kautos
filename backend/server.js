import express       from 'express';
import cors          from 'cors';
import dotenv        from 'dotenv';
import rateLimit     from 'express-rate-limit';
import path          from 'path';
import fs            from 'fs';
import http          from 'http';
import { fileURLToPath, pathToFileURL } from 'url';
import { connectDB, pool } from './config/db.js';
import { securityHeaders } from './middleware/security.js';
import { initRealtime } from './realtime.js';
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
const isProd = process.env.NODE_ENV === 'production';
const app = express();
app.disable('x-powered-by');

/* ── TRUST PROXY ──────────────────────────────
   Behind Cloudflare → Railway/Render the client IP arrives in X-Forwarded-For.
   Tell Express how many proxy hops to trust so req.ip (used by the rate-limiter)
   is the real client, not the proxy. Direct Railway = 1 hop; add Cloudflare = 2.
   A NUMBER (not `true`) keeps express-rate-limit from flagging a spoofable setup.
   In local dev there's no proxy, so default to 0 (don't trust XFF). */
const TRUST_PROXY = process.env.TRUST_PROXY ?? (isProd ? '1' : '0');
app.set('trust proxy', /^\d+$/.test(TRUST_PROXY) ? Number(TRUST_PROXY) : TRUST_PROXY);

app.use(securityHeaders);

/* ── CORS ─────────────────────────────────── */
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5500,http://127.0.0.1:5500,http://localhost:3000')
  .split(',').map(o => o.trim()).filter(Boolean);

// Railway/Render inject the service's own public domain. Always trust it so the
// backend-served frontend can call its own API in production without us having to
// hand-maintain ALLOWED_ORIGINS for it. (Covers a future custom domain too.)
const selfDomain = process.env.RAILWAY_PUBLIC_DOMAIN || process.env.RENDER_EXTERNAL_HOSTNAME;
if (selfDomain && !allowedOrigins.includes(`https://${selfDomain}`)) {
  allowedOrigins.push(`https://${selfDomain}`);
}

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

/* ── API ROUTES ───────────────────────────────
   Mounted under /v1 (canonical, versioned) AND at the root (legacy aliases),
   so existing callers using /cars keep working while new clients use /v1/cars. */
const api = express.Router();
api.use('/auth',         authRoutes);
api.use('/cars',         carRoutes);
api.use('/transactions', transactionRoutes);
api.use('/admin',        adminRoutes);
api.use('/chat',         chatbotRoutes);
api.use('/fx',           fxRoutes);
api.use('/clearance',    clearanceRoutes);
api.use('/subscribe',    subscribeRoutes);
api.use('/messages',     messageRoutes);
api.use('/vin',          vinRoutes);
api.get('/health', (_req, res) => res.json({ status: 'ok', ts: Date.now() }));

app.use('/v1', api);
app.use(api); // back-compat: unversioned paths still resolve

/* ── HEALTH CHECK ─────────────────────────────
   Root health for the platform healthcheck (Railway/Render probe this path). */
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: Date.now() }));

// Unmatched API routes return JSON, not the SPA's index.html.
app.use('/v1', (_req, res) => res.status(404).json({ message: 'Not found' }));

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
    .then(() => {
      // Wrap Express in an HTTP server so Socket.IO (real-time chat) can share it.
      const httpServer = http.createServer(app);
      const io = initRealtime(httpServer, isAllowedOrigin);
      app.set('io', io); // the messages route pushes new-message nudges through this
      httpServer.listen(PORT, () =>
        console.log(`🚗  4Kautos server → http://localhost:${PORT}`));

      // Graceful shutdown: PaaS platforms send SIGTERM on every deploy/restart.
      // Disconnect sockets, let in-flight requests finish, close the DB pool, then
      // exit — with a hard cap so a stuck request can't hang forever.
      let closing = false;
      const shutdown = (signal) => {
        if (closing) return;
        closing = true;
        console.log(`\n${signal} received — shutting down gracefully…`);
        io.close(async () => { // closes the sockets and the underlying HTTP server
          try { await pool.end(); } catch { /* already closed */ }
          process.exit(0);
        });
        setTimeout(() => { console.error('Forced exit (shutdown timed out)'); process.exit(1); }, 10_000).unref();
      };
      process.on('SIGTERM', () => shutdown('SIGTERM'));
      process.on('SIGINT',  () => shutdown('SIGINT'));
    })
    .catch(err => { console.error('Startup failed:', err.message); process.exit(1); });
}
