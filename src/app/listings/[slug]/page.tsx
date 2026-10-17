import { notFound } from "next/navigation";

type StaticListing = {
  slug: string;
  title: string;
  price: number;
  beds: number;
  baths: number;
  sqft: number;
  image: string;
  description: string;
};

const listings: StaticListing[] = [];

export default async function ListingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const listing = listings.find((item) => item.slug === slug);
  if (!listing) notFound();

  return (
    <main className="p-6">
      <h1 className="text-3xl font-bold">{listing.title}</h1>
      <p className="mt-2 text-lg">
        ${listing.price.toLocaleString()} • {listing.beds} bd • {listing.baths} ba • {listing.sqft} sqft
      </p>
      <p className="mt-6 max-w-2xl">{listing.description}</p>
    </main>
  );
}

export async function generateStaticParams() {
  return listings.map((item) => ({ slug: item.slug }));
}
