"use client";
import { useEffect, useState } from "react";

interface Listing {
  title: string;
  link: string;
  date: string;
  description: string;
}

export default function ManhattanListings() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/streeteasy")
      .then(async res => {
        if (!res.ok) {
          throw new Error(`HTTP error ${res.status}`);
        }
        const data = await res.json().catch(() => {
          throw new Error("Invalid JSON from API");
        });
        return data;
      })
      .then(data => {
        setListings(data.listings || []);
      })
      .catch(err => {
        console.error(err);
        setError("Unable to load listings at this time.");
      });
  }, []);

  if (error) return <div className="text-red-500">{error}</div>;
  if (listings.length === 0) return <div>Loading Manhattan listings...</div>;

  return (
    <div className="grid gap-4">
      {listings.map(listing => (
        <a
          key={listing.link}
          href={listing.link}
          target="_blank"
          rel="noopener noreferrer"
          className="block border p-4 rounded-xl hover:bg-gray-50 transition"
        >
          <h3 className="font-semibold">{listing.title}</h3>
          <p className="text-sm text-gray-500">{listing.date}</p>
          <p className="text-gray-700">{listing.description}</p>
        </a>
      ))}
    </div>
  );
}
