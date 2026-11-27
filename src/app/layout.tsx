import type { Metadata, Viewport } from "next";
import { Noto_Sans_KR, Poppins } from "next/font/google";
import { cookies } from "next/headers";
import { LanguageProvider } from "@/components/LanguageProvider";
import { parseLocale } from "@/lib/locale";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const notoSansKr = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
  preload: false,
  variable: "--font-noto",
  adjustFontFallback: false,
  fallback: ["Apple SD Gothic Neo", "Malgun Gothic"],
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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = parseLocale((await cookies()).get("aitch_locale")?.value);

  return (
    <html lang={locale} className={`${poppins.className} ${notoSansKr.variable}${locale === "ko" ? " locale-ko" : ""}`}>
      <body className="max-w-full overflow-x-clip">
        <LanguageProvider initialLocale={locale}>{children}</LanguageProvider>
      </body>
    </html>
  );
}
