import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'ChambaPay — Cross-Border Payroll & Local Currency Treasury for Latin America',
  description:
    'Pay LatAm contractors, studios, and suppliers directly in local currency (wARS, wBRL, wMXN, wCOP, wPEN, wCLP) with autonomous AI invoice extraction, institutional FX routing, and instant Celo Mainnet settlement.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-[#08120E] text-[#F4FBEF] selection:bg-[#E2FEA5] selection:text-[#08120E]">
        {children}
      </body>
    </html>
  );
}
