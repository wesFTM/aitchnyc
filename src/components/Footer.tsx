'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useI18n } from '@/components/LanguageProvider';

export default function Footer() {
  const { t } = useI18n();
  return (
    <footer className="bg-black text-white py-10 border-t border-white/10 flex flex-col items-center space-y-6">
      {/* Centered Logo */}
      <Image
        src="/aitchLogo_white.svg"
        alt="Aitch NYC Property Relations"
        width={160}
        height={100}
        unoptimized
      />
      <nav className="flex items-center gap-4 text-xs text-white/70">
        <Link href="/privacy" className="hover:text-white hover:underline">
          {t("footer.privacy")}
        </Link>
        <Link href="/terms" className="hover:text-white hover:underline">
          {t("footer.terms")}
        </Link>
      </nav>
    </footer>
  );
}
