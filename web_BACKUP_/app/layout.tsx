import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Custodex | Trustless Escrow Protocol',
  description: 'Non-custodial conditional payments secured by smart contracts. Built for trust, verified by code.',
  keywords: ['escrow', 'crypto', 'ethereum', 'smart contracts', 'defi', 'payments', 'trustless'],
  authors: [{ name: 'Custodex' }],
  openGraph: {
    title: 'Custodex | Trustless Escrow Protocol',
    description: 'Non-custodial conditional payments secured by smart contracts.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Custodex | Trustless Escrow Protocol',
    description: 'Non-custodial conditional payments secured by smart contracts.',
  },
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}