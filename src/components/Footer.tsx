'use client';

import Image from 'next/image';
import { FaInstagram, FaLinkedin } from 'react-icons/fa';

export default function Footer() {
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
    </footer>
  );
}
