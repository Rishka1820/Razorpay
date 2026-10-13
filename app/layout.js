import '@fontsource-variable/tasa-orbiter';
import './globals.css';
import { Providers } from '@/components/kit';

export const metadata = {
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Orders', statusBarStyle: 'default' },
  icons: { icon: '/icon-192.png', apple: '/icon-192.png' },
  title: 'Razorpay Orders (concept prototype)',
  description: 'Concept prototype: made-to-order sellers collect the correct amount due, with customer-approved changes.',
};

export const viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#ffffff' };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
