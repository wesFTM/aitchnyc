'use client';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ListingCard from '@/components/ListingCard';
import { listings } from '@/data/listings';

export default function HomePage() {
  

  return (
    <main className="relative bg-white text-black">
      <Header />

      {/* Hero Video Section with Overlay Text */}
     <section className="pt-40 pb-20 flex flex-col items-center justify-center px-6 md:px-20 lg:px-32">
  

  {/* Inset video container with play icon overlay */}
  <div
    className="relative w-full h-[70vh] overflow-hidden rounded-2xl shadow-2xl cursor-pointer group"
  >
   {/* Full-width image */}
<img
  className="w-full h-full object-cover mb-10"
  src="https://pub-04af6d5d54d24dcfac9a8f482a98a3bc.r2.dev/aitchNYChero.jpg"
  alt="Aitch NYC Propery Relations"
/>


  </div>
</section>

<section className="px-6 py-12">
  <div className="max-w-6xl mx-auto">
    <div className="flex items-center justify-between mb-6">
      <h2 className="text-2xl font-semibold">Featured Listings</h2>
      <a href="/listings" className="text-sm underline">View all</a>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {listings.slice(0, 6).map((l) => <ListingCard key={l.slug} listing={l} />)}
    </div>
  </div>
</section>

      <Footer />

    </main>
  );
}
