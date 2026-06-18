import { searchCars } from '@/lib/api';

export const metadata = {
  title: 'Browse preowned cars — 4Kautos',
  description: 'Search verified preowned vehicles from international sellers — filter by make, price and more.',
};

const MAKES = ['Toyota', 'Honda', 'Ford', 'BMW', 'Mercedes-Benz', 'Hyundai', 'Kia', 'Lexus', 'Nissan', 'Volkswagen'];
const SORTS = [
  { v: '-createdAt', label: 'Newest first' },
  { v: 'price', label: 'Price: low → high' },
  { v: '-price', label: 'Price: high → low' },
  { v: 'mileage', label: 'Lowest mileage' },
];

// Server Component. `searchParams` is the URL's query string (?make=Toyota&page=2),
// handed to us already parsed — so the whole page is built on the server from it.
export default async function ListingsPage({ searchParams }) {
  const { cars, total, pages } = await searchCars(searchParams);
  const page = Math.max(1, Number(searchParams.page) || 1);

  // Build a /listings URL that keeps the current filters but changes the page.
  const pageHref = (p) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) if (v && k !== 'page') sp.set(k, String(v));
    sp.set('page', String(p));
    return `/listings?${sp.toString()}`;
  };

  const money = (c) => c.price != null
    ? `${c.currency === 'USD' ? '$' : '₦'}${Number(c.price).toLocaleString()}`
    : 'Price on request';

  return (
    <main className="wrap">
      <header className="topbar">
        <a className="brand" href="/">4KAUTOS</a>
        <span className="tag">Browse · server-rendered</span>
      </header>
      <h1>Browse cars</h1>

      {/* Plain GET form — no client JavaScript. Submitting updates the URL and the
          server re-renders with the new results. Each filter combo is its own
          shareable, crawlable URL. */}
      <form method="GET" className="filters">
        <input className="f-input" type="text" name="q" placeholder="Search make, model…" defaultValue={searchParams.q || ''} />
        <select className="f-input" name="make" defaultValue={searchParams.make || ''}>
          <option value="">Any make</option>
          {MAKES.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <input className="f-input" type="number" name="minPrice" placeholder="Min price" defaultValue={searchParams.minPrice || ''} />
        <input className="f-input" type="number" name="maxPrice" placeholder="Max price" defaultValue={searchParams.maxPrice || ''} />
        <select className="f-input" name="sort" defaultValue={searchParams.sort || '-createdAt'}>
          {SORTS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
        </select>
        <button className="f-btn" type="submit">Apply</button>
      </form>

      <p className="muted count">{total} {total === 1 ? 'car' : 'cars'} found</p>

      {cars.length === 0 ? (
        <p className="muted">No cars match those filters — <a href="/listings" style={{ color: 'var(--accent)' }}>clear all</a>.</p>
      ) : (
        <div className="grid">
          {cars.map((c) => (
            <a key={c.id} className="card" href={`/cars/${c.id}`}>
              {c.photos?.[0] && <img src={c.photos[0]} alt={c.title || ''} />}
              <div className="card-body">
                <div className="card-title">{c.title || `${c.year} ${c.make} ${c.model}`}</div>
                <div className="card-meta">{c.location || ''}</div>
                <div className="card-price">{money(c)}</div>
              </div>
            </a>
          ))}
        </div>
      )}

      {pages > 1 && (
        <nav className="pager">
          {page > 1 ? <a className="pg" href={pageHref(page - 1)}>← Prev</a> : <span className="pg disabled">← Prev</span>}
          <span className="pg-info">Page {page} of {pages}</span>
          {page < pages ? <a className="pg" href={pageHref(page + 1)}>Next →</a> : <span className="pg disabled">Next →</span>}
        </nav>
      )}
    </main>
  );
}
