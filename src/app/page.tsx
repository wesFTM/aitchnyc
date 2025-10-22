'use client';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { listings } from '@/data/listings';
import ListingCard from '@/components/ListingCard';

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

<section className="py-20 px-6 md:px-12 bg-black text-white">
  <h2 className="text-3xl md:text-4xl font-bold mb-10">Featured Listings</h2>
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
    {listings.slice(0, 3).map((listing) => (
      <ListingCard key={listing.slug} listing={listing} />
    ))}
  </div>
</section>

      <Footer />

    </main>
  );
}
