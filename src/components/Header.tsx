'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { Menu, X } from 'lucide-react'; // npm install lucide-react


export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);

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

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-6 text-black font-bold text-xs">
          <Link href="/about" className="hover:underline">About</Link>
          <Link href="/login" className="hover:underline">Sign in</Link>
          <Link href="mailto:wfulghum@gmail.com?subject=Portfolio%20Inquiry" className="hover:underline">Contact</Link>
        </nav>

        {/* Hamburger Icon */}
        <button
          onClick={() => setMobileOpen(true)}
          className="shrink-0 text-black md:hidden"
          aria-label="Open menu"
        >
          <Menu size={28} />
        </button>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 bg-black/90 px-6 py-8 flex flex-col items-start space-y-6 text-white text-lg font-semibold">
          <button onClick={() => setMobileOpen(false)} className="absolute top-4 right-4 text-white" aria-label="Close menu">
            <X size={28} />
          </button>

          <Link href="/about" className="hover:underline" onClick={() => setMobileOpen(false)}>ABOUT</Link>
          <Link href="/login" className="hover:underline" onClick={() => setMobileOpen(false)}>SIGN IN</Link>
          <Link href="mailto:haitch@gmail.com?subject=Rental%20Inquiry" onClick={() => setMobileOpen(false)}>CONTACT</Link>

        </div>
      )}
    </>
  );
}
