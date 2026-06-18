import './globals.css';

// Default metadata for the whole app. Individual pages (like the car detail page)
// can override this with their own generateMetadata().
export const metadata = {
  title: '4Kautos — Premium Preowned Cars',
  description: 'Buy verified preowned vehicles from international sellers, cleared and delivered in Nigeria.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
