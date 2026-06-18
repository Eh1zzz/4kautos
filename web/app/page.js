import { getCars } from '@/lib/api';

export const revalidate = 60;

// Server Component: this runs on the server, fetches the listings from your API,
// and returns finished HTML.
export default async function Home() {
  const cars = await getCars();
  return (
    <main className="wrap">
      <header className="topbar">
        <span className="brand">4KAUTOS</span>
        <a className="tag" href="/listings">Browse cars →</a>
      </header>
      <h1>Listings</h1>
      <p className="muted">Server-rendered from your Express API. Open any car to see the SEO-ready detail page.</p>

      {cars.length === 0 ? (
        <p className="muted" style={{ marginTop: '1rem' }}>
          No cars returned — is the API running on {API_BASE_LABEL}?
        </p>
      ) : (
        <div className="grid">
          {cars.map((c) => (
            <a key={c.id} className="card" href={`/cars/${c.id}`}>
              {c.photos?.[0] && <img src={c.photos[0]} alt={c.title || ''} />}
              <div className="card-body">
                <div className="card-title">{c.title || `${c.year} ${c.make} ${c.model}`}</div>
                <div className="card-meta">{c.location || ''}</div>
              </div>
            </a>
          ))}
        </div>
      )}
    </main>
  );
}

const API_BASE_LABEL = process.env.API_BASE || 'http://localhost:3000';
