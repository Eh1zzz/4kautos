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

// Search/browse with filters + pagination. `cache: 'no-store'` makes it dynamic
// (rendered on every request) since results vary by query — the right choice for
// search. Reads the X-Total-* headers the API sets for pagination.
export async function searchCars(searchParams = {}) {
  const allow = ['q', 'make', 'model', 'year', 'minPrice', 'maxPrice', 'condition', 'type', 'sort', 'page', 'limit', 'minUsd', 'maxUsd'];
  const qs = new URLSearchParams();
  for (const k of allow) {
    const v = searchParams[k];
    if (v != null && v !== '') qs.set(k, String(v));
  }
  if (!qs.has('limit')) qs.set('limit', '12');

  const res = await fetch(`${API_BASE}/v1/cars?${qs.toString()}`, { cache: 'no-store' });
  if (!res.ok) return { cars: [], total: 0, pages: 1 };
  const cars = await res.json();
  return {
    cars,
    total: Number(res.headers.get('X-Total-Count')) || cars.length,
    pages: Number(res.headers.get('X-Total-Pages')) || 1,
  };
}
