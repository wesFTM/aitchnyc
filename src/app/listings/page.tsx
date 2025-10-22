import ListingCard from '@/components/ListingCard';
import { listings } from '@/data/listings';

export default function ListingsPage() {
  return (
    <main className="py-20 px-6 md:px-12 bg-black text-white">
      <h1 className="text-3xl md:text-4xl font-bold mb-10">Available Listings</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {listings.map((listing) => (
          <ListingCard key={listing.slug} listing={listing} />
        ))}
      </div>
    </main>
  );
}
