import express       from 'express';
import cors          from 'cors';
import dotenv        from 'dotenv';
import rateLimit     from 'express-rate-limit';
import path          from 'path';
import fs            from 'fs';
import http          from 'http';
import { fileURLToPath, pathToFileURL } from 'url';
import { connectDB, pool } from './config/db.js';
import { scheduleBackups } from './utils/backup.js';
import { securityHeaders, rateLimitStore } from './middleware/security.js';
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
import paymentRoutes     from './routes/payments.js';
import savedSearchRoutes from './routes/savedSearches.js';
import contactRoutes     from './routes/contact.js';
import sellerRoutes      from './routes/sellers.js';
import savedCarRoutes    from './routes/savedCars.js';
import reviewRoutes      from './routes/reviews.js';

dotenv.config();

/* ── SENTRY (error observability) ─────────────
   Inert without SENTRY_DSN ($0 mode). With a DSN set on Railway, unhandled
   route errors are captured via the Express handler below, and every
   console.error is forwarded too — the route handlers all catch their own
   errors and log them, so without this forwarding Sentry would only ever see
   the rare unhandled ones. */
const SENTRY_DSN = process.env.SENTRY_DSN || '';
let Sentry = null;
if (SENTRY_DSN) {
  Sentry = await import('@sentry/node');
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.RAILWAY_GIT_COMMIT_SHA || undefined,
    tracesSampleRate: 0, // errors only — no paid-tier performance tracing
  });
  const origError = console.error.bind(console);
  console.error = (...args) => {
    origError(...args);
    try {
      const msg = args.map(a => (a instanceof Error ? a.stack : typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
      Sentry.captureMessage(msg.slice(0, 2000), 'error');
    } catch { /* never let telemetry break logging */ }
  };
  console.log('🛰  Sentry error reporting enabled');
}

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

/* ── CSP VIOLATION REPORTS ────────────────────
   Intake for the report-only strict CSP (see middleware/security.js). Mounted
   BEFORE the global limiter so browser-fired reports don't spend a visitor's
   request budget; it gets its own tight limiter instead. Each unique violation
   is logged once per boot (dedupe) so real users can't flood the logs. */
const cspSeen = new Set();
app.post('/csp-report',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: false, legacyHeaders: false,
              store: rateLimitStore('rl:csp:'), message: '' }),
  express.json({ type: () => true, limit: '16kb' }), // browsers send application/csp-report, not application/json
  (req, res) => {
    const r = req.body?.['csp-report'] || {};
    if (r['violated-directive']) {
      const doc = String(r['document-uri'] || '').split('?')[0];
      const key = `${doc} | ${r['violated-directive']} | ${r['blocked-uri'] || ''} | ${r['source-file'] || ''}:${r['line-number'] || ''}`;
      if (!cspSeen.has(key) && cspSeen.size < 500) {
        cspSeen.add(key);
        console.warn(`[csp-report] ${key}`);
      }
    }
    res.status(204).end();
  });

/* ── BODY PARSING ─────────────────────────── */
app.use(express.json({ limit: '2mb' }));
// extended:false (no qs nesting) + caps to blunt parameter-pollution / payload DoS.
app.use(express.urlencoded({ extended: false, limit: '100kb', parameterLimit: 100 }));

/* ── RATE LIMITING ────────────────────────── */
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  store: rateLimitStore('rl:global:'), // shared across replicas when REDIS_URL is set
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
api.use('/payments',     paymentRoutes);
api.use('/saved-searches', savedSearchRoutes);
api.use('/contact',      contactRoutes);
api.use('/sellers',      sellerRoutes);
api.use('/saved-cars',   savedCarRoutes);
api.use('/reviews',      reviewRoutes);
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

/* Listing links shared into WhatsApp/social must unfurl with the car's photo,
   title and price — crawlers don't run JS, so the Open Graph tags are injected
   server-side into detail.html before the static handler can serve it plain.
   Unknown/missing ids fall through to the unmodified page. */
const escAttr = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
app.get('/detail.html', async (req, res, next) => {
  try {
    const { toId } = await import('./utils/validation.js');
    if (!toId(req.query.id)) return next();
    const { findById } = await import('./models/Car.js');
    const car = await findById(req.query.id);
    if (!car) return next();

    const { baseUrl } = await import('./utils/url.js');
    const base  = baseUrl(req);
    const title = car.title || [car.year, car.make, car.model].filter(Boolean).join(' ');
    const sym   = (car.currency || 'NGN') === 'USD' ? '$' : '₦';
    const price = car.price != null ? `${sym}${Number(car.price).toLocaleString('en-US')}` : 'Price on request';
    const bits  = [price, car.mileage ? `${Number(car.mileage).toLocaleString('en-US')} km` : null, car.location].filter(Boolean).join(' · ');
    const desc  = `${bits}. ${String(car.description || 'Verified listing on 4Kautos, with escrow protection and clearance handled.').replace(/\s+/g, ' ')}`.slice(0, 200);
    let img = car.photos?.[0] || '';
    if (img.startsWith('/')) img = base + img;   // legacy local uploads → absolute

    const tags = [
      `<meta property="og:type" content="website">`,
      `<meta property="og:site_name" content="4Kautos">`,
      `<meta property="og:title" content="${escAttr(`${title} · ${price}`)}">`,
      `<meta property="og:description" content="${escAttr(desc)}">`,
      img ? `<meta property="og:image" content="${escAttr(img)}">` : '',
      `<meta property="og:url" content="${escAttr(`${base}/detail.html?id=${car.id}`)}">`,
      `<meta name="twitter:card" content="${img ? 'summary_large_image' : 'summary'}">`,
    ].filter(Boolean).join('\n  ');

    const html = (await fs.promises.readFile(path.join(frontendDir, 'detail.html'), 'utf8'))
      .replace('<title>Car Details | 4Kautos</title>', `<title>${escAttr(title)} | 4Kautos</title>\n  ${tags}`);
    res.type('html').send(html);
  } catch (err) {
    console.error('OG inject:', err.message);
    next(); // never block the page over the unfurl garnish
  }
});
app.use(express.static(frontendDir));
app.get('/{*path}', (_req, res) => res.sendFile(path.join(frontendDir, 'index.html')));

/* ── GLOBAL ERROR HANDLER ─────────────────── */
if (Sentry) Sentry.setupExpressErrorHandler(app); // report, then fall through to ours
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
    .then(async () => {
      // Wrap Express in an HTTP server so Socket.IO (real-time chat) can share it.
      const httpServer = http.createServer(app);
      const io = await initRealtime(httpServer, isAllowedOrigin); // async: may attach the Redis adapter
      app.set('io', io); // the messages route pushes new-message nudges through this
      httpServer.listen(PORT, () =>
        console.log(`🚗  4Kautos server → http://localhost:${PORT}`));

      // Daily DB backups (on by default in production; BACKUP_ENABLED=1 forces on in dev).
      if (isProd || process.env.BACKUP_ENABLED === '1') scheduleBackups();

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
