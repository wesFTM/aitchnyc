// src/app/listings/[slug]/page.tsx
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { listings } from '@/data/listings';

export default function ListingDetail({ params }: { params: { slug: string } }) {
  const listing = listings.find(l => l.slug === params.slug);
  if (!listing) return notFound();

  return (
    <main className="px-6 py-10 max-w-5xl mx-auto text-white">
      <div className="relative aspect-[16/9] rounded-2xl overflow-hidden bg-black/20">
        <Image src={listing.images?.[0] ?? '/placeholder.jpg'} alt={listing.title} fill className="object-cover" />
      </div>

      <h1 className="mt-6 text-3xl font-bold">{listing.title}</h1>
      <p className="text-xl mt-2">
        ${listing.price.toLocaleString()} • {listing.beds} bd • {listing.baths} ba • {listing.sqft ?? '—'} sqft
      </p>
      <p className="mt-2 text-white/70">
        {listing.address}, {listing.city ?? 'New York'}, {listing.state ?? 'NY'} {listing.zip}
      </p>

      {listing.description && <article className="prose prose-invert mt-6 max-w-none">{listing.description}</article>}
    </main>
  );
}
