// Where the Express API lives. These fetches run on the Next.js SERVER (not the
// browser), so there's no CORS involved. Override with API_BASE in web/.env.local;
// defaults to your local backend on :3000.
export const API_BASE = process.env.API_BASE || 'http://localhost:3000';

// `next: { revalidate: 60 }` caches the fetch result for 60s (this is what powers
// ISR — Incremental Static Regeneration).
export async function getCar(id) {
  const res = await fetch(`${API_BASE}/v1/cars/${id}`, { next: { revalidate: 60 } });
  if (!res.ok) return null;
  return res.json();
}

export async function getCars() {
  const res = await fetch(`${API_BASE}/v1/cars?limit=24`, { next: { revalidate: 60 } });
  if (!res.ok) return [];
  return res.json();
}
