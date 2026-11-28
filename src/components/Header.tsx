'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { Menu, X } from 'lucide-react'; // npm install lucide-react
import { LanguageToggle } from '@/components/LanguageToggle';
import { useI18n } from '@/components/LanguageProvider';


export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { t } = useI18n();

  return (
    <>
      <header className="absolute top-0 left-0 z-30 flex w-full max-w-full items-center justify-between overflow-x-clip bg-transparent px-6 py-5 backdrop-blur-sm lg:px-30">
        {/* Left: Logo + Subtitle */}
        <Link href="/" className="min-w-0">
          <Image
            src="/aitchLogo.svg"
            alt="Aitch Nyc Logo"
            width={250}
            height={140}
            className="h-12 w-auto"
            unoptimized
          />
        </Link>

        <div className="flex shrink-0 items-center gap-3 md:gap-6">
          <LanguageToggle />
          <nav className="hidden items-center gap-6 text-xs font-bold text-black md:flex">
            <Link href="/about" className="hover:underline">{t("nav.about")}</Link>
            <Link href="/login" className="hover:underline">{t("nav.signIn")}</Link>
            <Link href="/contact" className="hover:underline">{t("nav.contact")}</Link>
          </nav>
          <button
            onClick={() => setMobileOpen(true)}
            className="shrink-0 text-black md:hidden"
            aria-label={t("nav.openMenu")}
          >
            <Menu size={28} />
          </button>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 bg-black/90 px-6 py-8 flex flex-col items-start space-y-6 text-white text-lg font-semibold">
          <button onClick={() => setMobileOpen(false)} className="absolute top-4 right-4 text-white" aria-label={t("nav.closeMenu")}>
            <X size={28} />
          </button>

          <LanguageToggle />
          <Link href="/about" className="hover:underline" onClick={() => setMobileOpen(false)}>{t("nav.aboutUpper")}</Link>
          <Link href="/login" className="hover:underline" onClick={() => setMobileOpen(false)}>{t("nav.signInUpper")}</Link>
          <Link href="/contact" className="hover:underline" onClick={() => setMobileOpen(false)}>{t("nav.contactUpper")}</Link>

        </div>
      )}
    </>
  );
}
