// src/components/ListingCard.tsx
import Image from 'next/image';
import Link from 'next/link';
import type { Listing } from '@/data/listings';

export default function ListingCard({ listing }: { listing: Listing }) {
  const cover = listing.images?.[0] ?? '/placeholder.jpg';
  return (
    <Link
      href={`/listings/${listing.slug}`}
      className="group block rounded-2xl overflow-hidden border border-white/10 hover:border-white transition"
    >
      <div className="relative aspect-[4/3]">
        <Image src={cover} alt={listing.title} fill className="object-cover group-hover:scale-105 transition-transform" />
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{listing.title}</h3>
          <span className="font-semibold">${listing.price.toLocaleString()}</span>
        </div>
        <p className="text-sm text-white/70">
          {listing.beds} bd • {listing.baths} ba • {listing.neighborhood ?? 'NYC'}
        </p>
      </div>
    </Link>
  );
}
