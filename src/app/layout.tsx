import type { Metadata, Viewport } from "next";
import { Poppins } from 'next/font/google';
import "./globals.css";

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: "Aitch NYC",
  description: "Licensed Real Estate Agents",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={poppins.className}>
      <body className="max-w-full overflow-x-clip">{children}</body>
    </html>
  );
}
