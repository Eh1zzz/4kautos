import { pool } from '../config/db.js';

/* Idempotency for replay-safe mutations (money endpoints). When the client sends
   an `Idempotency-Key` header, the first request executes and its response is
   stored under that key; any later request with the SAME key replays the stored
   response instead of re-executing — so a network retry or a replayed request
   can never double-charge / double-create.

   The row insert is the atomic lock (PK on id_key):
     • INSERT succeeds  → we own this key, run the handler, then finalize the row.
     • INSERT conflicts → already seen: replay the stored response, or 409 if the
       original is still in flight (status_code still NULL).
   5xx responses are NOT cached (the row is dropped) so transient failures stay
   retryable. No header → behaves exactly as before (opt-in). */
export function idempotent() {
  return async (req, res, next) => {
    const key = req.headers['idempotency-key'];
    if (!key || typeof key !== 'string' || key.length > 80) return next();
    const scope = `${req.user?.id || 0}:${req.method}:${req.baseUrl}${req.path}`;

    try {
      await pool.query('INSERT INTO idempotency_keys (id_key, scope, status_code) VALUES (?, ?, NULL)', [key, scope]);
    } catch {
      // Key already exists → it's a replay (or an in-flight duplicate).
      let row;
      try { [[row]] = await pool.query('SELECT status_code, response FROM idempotency_keys WHERE id_key = ? AND scope = ?', [key, scope]); } catch {}
      if (!row || row.status_code == null)
        return res.status(409).json({ message: 'A request with this Idempotency-Key is already being processed' });
      return res.status(row.status_code).json(JSON.parse(row.response));
    }

    // We reserved the key — finalize the row BEFORE sending, so an immediate
    // replay can't observe the key still "in progress" (and 5xx stays retryable).
    const origJson = res.json.bind(res);
    res.json = async (body) => {
      try {
        if (res.statusCode >= 500)
          await pool.query('DELETE FROM idempotency_keys WHERE id_key = ? AND scope = ?', [key, scope]);
        else
          await pool.query('UPDATE idempotency_keys SET status_code = ?, response = ? WHERE id_key = ? AND scope = ?',
            [res.statusCode, JSON.stringify(body ?? {}), key, scope]);
      } catch { /* best-effort; never block the response on the bookkeeping write */ }
      return origJson(body);
    };
    next();
  };
}
