/* Shared origin/base-URL derivation for links we build server-side (verify &
   reset emails, payment redirect). Honours APP_BASE_URL, else the request host,
   and always collapses to the bare origin so a stray path in APP_BASE_URL can't
   corrupt the link. */
export function baseUrl(req) {
  const raw = process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`;
  try { return new URL(raw).origin; } catch { return `${req.protocol}://${req.get('host')}`; }
}
