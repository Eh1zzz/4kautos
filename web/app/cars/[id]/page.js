import { notFound } from 'next/navigation';
import { getCar } from '@/lib/api';

// ISR: serve a cached HTML copy of this page and quietly rebuild it at most once a
// minute. Fast for visitors, fresh when a listing changes, and easy on the API.
export const revalidate = 60;

// Runs on the SERVER per listing — sets the <title> and the Open Graph / Twitter
// tags that produce the rich link preview when a car is shared (WhatsApp, X, etc.).
export async function generateMetadata({ params }) {
  const car = await getCar(params.id);
  if (!car) return { title: 'Car not found — 4Kautos' };
  const name = car.title || `${car.year} ${car.make} ${car.model}`;
  const title = `${name} — 4Kautos`;
  const description = car.description || `${name} for sale on 4Kautos — cleared & delivered in Nigeria.`;
  const image = car.photos?.[0];
  return {
    title,
    description,
    openGraph: { title, description, type: 'website', images: image ? [{ url: image }] : [] },
    twitter: { card: 'summary_large_image', title, description, images: image ? [image] : [] },
  };
}

// A Server Component: the whole function runs on the server, so the car's data is
// baked into the HTML before it reaches a browser — or a search-engine crawler.
export default async function CarPage({ params }) {
  const car = await getCar(params.id);
  if (!car) notFound();

  const name = car.title || `${car.year} ${car.make} ${car.model}`;
  const price = car.price != null
    ? `${car.currency === 'USD' ? '$' : '₦'}${Number(car.price).toLocaleString()}`
    : 'Price on request';

  const specs = [
    ['Make', car.make], ['Model', car.model], ['Year', car.year],
    ['Mileage', car.mileage != null ? `${Number(car.mileage).toLocaleString()} km` : null],
    ['Condition', car.condition], ['Location', car.location], ['VIN', car.vin],
  ].filter(([, v]) => v != null && v !== '');

  return (
    <main className="wrap">
      <header className="topbar">
        <a className="brand" href="/">4KAUTOS</a>
        <a className="tag" href="/listings">← All listings</a>
      </header>

      {car.photos?.[0] && <img className="hero" src={car.photos[0]} alt={name} />}

      <h1>{name}</h1>
      <div className="price">{price}</div>

      <p className="desc">{car.description || 'No description provided.'}</p>

      <dl className="specs">
        {specs.map(([k, v]) => (
          <div className="spec" key={k}>
            <dt>{k}</dt>
            <dd>{String(v)}</dd>
          </div>
        ))}
      </dl>

      {car.seller && (
        <div className="seller">
          Seller: <strong>{car.seller.name}</strong>{car.seller.verified ? ' · ✓ verified' : ''}
        </div>
      )}
    </main>
  );
}
