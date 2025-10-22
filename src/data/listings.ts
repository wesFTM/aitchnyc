// src/data/listings.ts
export type Listing = {
    slug: string;
    title: string;
    status?: 'active' | 'pending' | 'sold';
    price: number;           // in USD
    beds: number;
    baths: number;
    sqft?: number;
    neighborhood?: string;
    address: string;
    city?: string;
    state?: string;
    zip?: string;
    images: string[];        // public/… or remote
    description?: string;
    features?: string[];
    agent?: {
      name: string;
      email?: string;
      phone?: string;
      headshot?: string;
    };
  };
  
  export const listings: Listing[] = [
    {
      slug: '123-main-st-5b',
      title: 'Bright 2BR in Chelsea',
      status: 'active',
      price: 1495000,
      beds: 2,
      baths: 1,
      sqft: 900,
      neighborhood: 'Chelsea',
      address: '123 Main St #5B',
      city: 'New York',
      state: 'NY',
      zip: '10011',
      images: ['/listingimages/1001.jpg', '/listingimages/1002.jpg'],
      description:
        'South-facing, in-unit W/D, elevator building. Close to High Line.',
      features: ['Elevator', 'Washer/Dryer', 'Dishwasher', 'Pet-friendly'],
      agent: { name: 'Agent One', email: 'agent1@example.com' },
    },
    {
      slug: '161 Lafayette',
      title: 'Studio in Soho',
      status: 'active',
      price: 1495000,
      beds: 0,
      baths: 1,
      sqft: 300,
      neighborhood: 'Soho',
      address: '123 Main St #5B',
      city: 'New York',
      state: 'NY',
      zip: '10011',
      images: ['/listingimages/1002.jpg', '/photos/chelsea-5b-2.jpg'],
      description:
        'South-facing, in-unit W/D, elevator building. Close to High Line.',
      features: ['Elevator', 'Washer/Dryer', 'Dishwasher', 'Pet-friendly'],
      agent: { name: 'Agent One', email: 'agent1@example.com' },
    },
    {
      slug: '324 Avenue B.',
      title: '1 Bed in Alphabet',
      status: 'active',
      price: 1495000,
      beds: 1,
      baths: 1,
      sqft: 900,
      neighborhood: 'Chelsea',
      address: '123 Main St #5B',
      city: 'New York',
      state: 'NY',
      zip: '10011',
      images: ['/listingimages/1003.jpg', '/photos/chelsea-5b-2.jpg'],
      description:
        'South-facing, in-unit W/D, elevator building. Close to High Line.',
      features: ['Elevator', 'Washer/Dryer', 'Dishwasher', 'Pet-friendly'],
      agent: { name: 'Agent One', email: 'agent1@example.com' },
    },
    // add more…
  ];
  