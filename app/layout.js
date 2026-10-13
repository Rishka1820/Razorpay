import '@fontsource-variable/tasa-orbiter';
import './globals.css';
import { Providers } from '@/components/kit';

export const metadata = {
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Orders', statusBarStyle: 'default' },
  icons: { icon: '/icon-192.png', apple: '/icon-192.png' },
  title: 'Razorpay OrderBook',
  description: 'The order ledger for social sellers. Every change agreed. Every payment counted.',
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
