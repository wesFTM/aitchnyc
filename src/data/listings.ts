export type Listing = {
  slug: string;
  title: string;
  price: number;
  beds: number;
  baths: number;
  sqft?: number;
  neighborhood?: string;
  address: string;
  city?: string;
  state?: string;
  zip?: string;
  image: string;
  description?: string;
  status?: 'active' | 'pending' | 'sold';
};

export const listings: Listing[] = [
  {
    slug: 'chelsea-apt',
    title: 'Modern 2BR in Chelsea',
    price: 1450000,
    beds: 2,
    baths: 2,
    sqft: 980,
    neighborhood: 'Chelsea',
    address: '123 W 23rd St #5B',
    city: 'New York',
    state: 'NY',
    zip: '10011',
    image: '/listingimages/1001.jpg', // or .jpg, placeholder
    description:
      'Beautiful 2-bedroom apartment with floor-to-ceiling windows, private balcony, and open kitchen.',
    status: 'active',
  },
  {
    slug: 'brooklyn-loft',
    title: 'Spacious Loft in Williamsburg',
    price: 1895000,
    beds: 3,
    baths: 2,
    sqft: 1300,
    neighborhood: 'Williamsburg',
    address: '85 Wythe Ave #2A',
    city: 'Brooklyn',
    state: 'NY',
    zip: '11249',
    image: '/listingimages/1002.jpg', // or .jpg
    description:
      'Sun-drenched loft with 12ft ceilings and rooftop access in the heart of Williamsburg.',
    status: 'active',
  },
  {
    slug: 'east-villiage-studio',
    title: 'East Villiage Studio',
    price: 1895000,
    beds: 0,
    baths: 1,
    sqft: 400,
    neighborhood: 'East Vil',
    address: '85 Wythe Ave #2A',
    city: 'Brooklyn',
    state: 'NY',
    zip: '11249',
    image: '/listingimages/1003.jpg', // or .jpg
    description:
      'Sun-drenched loft with 12ft ceilings and rooftop access in the heart of Williamsburg.',
    status: 'active',
  },
];
