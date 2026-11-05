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
  title: 'ChambaPay | Tu Money, Sin Borders — Autonomous Celo FX, Invoice & @celo/buy Agent',
  description:
    'Autonomous LatAm cross-border treasury, invoice, and payroll agent on Celo Mainnet (Chain 42220). Powered by @celo/buy (usebuy.ai), USA₮ x402, Textile FX, Ripio wFIAT, and ERC-8004 identity (celo_42cd0161c62d).',
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
