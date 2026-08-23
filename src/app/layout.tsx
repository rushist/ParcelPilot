import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ParcelPilot — Logistics Support & Operations AI',
  description: 'Deterministic, citation-grounded AI support engine for ParcelPilot',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bitcount+Single:wght@100..900&family=Google+Sans:ital,opsz,wght@0,17..18,400..700;1,17..18,400..700&family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-google-sans bg-[#050505] text-white min-h-screen antialiased selection:bg-white selection:text-black">
        {children}
      </body>
    </html>
  );
}
