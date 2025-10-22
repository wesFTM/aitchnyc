import { notFound } from 'next/navigation';
import { listings } from '@/data/listings';
import Image from 'next/image';

type PageProps = { params: { slug: string } };

export default function ListingPage({ params }: PageProps) {
  const listing = listings.find((l) => l.slug === params.slug);
  if (!listing) notFound();

  return (
    <main className="min-h-screen flex flex-col items-center justify-center text-black text-center p-10">
      <h1 className="text-4xl font-bold">{listing.title}</h1>
      <p className="mt-3 text-xl font-semibold">
        ${listing.price.toLocaleString()}
      </p>
      <p className="mt-3 text-lg">
        {listing.beds} bd • {listing.baths} ba • {listing.neighborhood}
      </p>
      <div className="mt-8 w-full max-w-4xl rounded-lg overflow-hidden shadow-lg">
        <Image
          src={listing.image}
          alt={listing.title}
          width={1200}
          height={800}
          className="object-cover w-full"
        />
      </div>
      <p className="mt-5 max-w-2xl text-black/80">{listing.description}</p>
      <p className="mt-3 text-sm text-black/60">
        {listing.address}, {listing.city ?? 'New York'}, {listing.state ?? 'NY'}{' '}
        {listing.zip}
      </p>
    </main>
  );
}
