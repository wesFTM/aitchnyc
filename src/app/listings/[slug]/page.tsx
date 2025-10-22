import { notFound } from 'next/navigation';
import Image from 'next/image';
import { listings } from '@/data/listings';

export default async function ListingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const listing = listings.find((l) => l.slug === slug);
  if (!listing) notFound();

  return (
    <main className="p-6">
      <h1 className="text-3xl font-bold">{listing.title}</h1>
      <p className="mt-2 text-lg">
        ${listing.price.toLocaleString()} • {listing.beds} bd • {listing.baths} ba • {listing.sqft} sqft
      </p>

      <Image
        src={listing.image}
        alt={listing.title}
        width={1200}
        height={800}
        className="mt-6 rounded-xl"
      />

      <p className="mt-6 max-w-2xl">{listing.description}</p>
    </main>
  );
}

export async function generateStaticParams() {
  return listings.map((l) => ({ slug: l.slug }));
}
