import Image from 'next/image';
import Link from 'next/link';
import type { Listing } from '@/data/listings';

export default function ListingCard({ listing }: { listing: Listing }) {
  return (
    <Link
      href={`/listings/${listing.slug}`}
      className="group block rounded-lg overflow-hidden border border-white/10 hover:border-white transition"
    >
      <div className="relative aspect-[4/3] bg-black">
        <Image
          src={listing.image}
          alt={listing.title}
          fill
          className="object-cover group-hover:scale-105 transition-transform"
        />
      </div>
      <div className="p-4 text-white/90">
        <h3 className="text-lg font-semibold">{listing.title}</h3>
        <p className="text-sm">
          {listing.beds} bd • {listing.baths} ba •{' '}
          {listing.neighborhood ?? 'NYC'}
        </p>
        <p className="font-bold mt-1">${listing.price.toLocaleString()}</p>
      </div>
    </Link>
  );
}
