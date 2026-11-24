import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Privacy policy · Aitch NYC",
  description: "How Aitch NYC handles administrator sign-in, client page links, and private listing information.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white text-black">
      <Header />
      <article className="mx-auto max-w-3xl space-y-8 px-6 pb-24 pt-40 text-sm leading-7 text-neutral-800">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold text-black">Privacy policy</h1>
          <p className="text-neutral-500">Last updated November 24, 2026</p>
        </header>

        <p>
          Aitch NYC is a private listings site for invited clients. This page describes what we
          collect, why we collect it, and who can see it.
        </p>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-black">Who we are</h2>
          <p>
            The site is operated by Aitch NYC. Questions about this policy can be sent to{" "}
            <a className="underline" href="mailto:wfulghum@gmail.com">
              wfulghum@gmail.com
            </a>
            .
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-black">Accounts</h2>
          <p>
            Super admins sign in with Google. A super admin can also add another administrator by
            the Google email that person will use. When that person signs in, we receive their
            name, email address, and whether Google has verified that email. We store that
            information so we can recognize them on later visits. Those administrators see the
            listings and clients on their own list. Listings and clients they add are also kept on
            the master list, with a note of who added them. A super admin can hide or delete a master
            record, which removes it from that administrator&apos;s list as well.
          </p>
          <p>
            Clients are added by an administrator. Email is optional. We store the
            client&apos;s name, phone number, email when one is provided, company website, company zip code, and company logo, and a private link to their listings page. Opening that
            link does not require a Google account. Anyone with the link can see the listings
            assigned to that client. When a client likes a listing, we store that choice so an
            administrator can see which listings they are interested in. A tour request on a liked listing is stored
            so an administrator can follow up. If Google confirms an administrator email that is not allowed,
            we do not create an account.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-black">Listings</h2>
          <p>
            Administrators save listing details, including the address, unit, price, neighborhood,
            size, bedrooms, bathrooms, amenities, description, rental, sale, or commercial status, photos, and one
            video. Clients see only the listings on their page. Other administrators see the listings
            and clients on their own list. Text changes an administrator makes to something they added
            stay on their list. Photos stay with the shared listing.
          </p>
          <p>
            To place an address on the map, we send the street address, without the unit number, to
            the U.S. Census Bureau geocoder and, if needed, OpenStreetMap Nominatim. The map tiles
            are served by OpenStreetMap.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-black">Cookies</h2>
          <p>
            After you sign in, we set an httpOnly cookie that keeps you signed in for 14 days. A
            short-lived cookie is also used while Google sign-in is in progress. These cookies are
            used to operate the site, not to advertise.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-black">Where information is stored</h2>
          <p>
            Account and listing records are stored in Cloudflare D1. Photos and video are stored in
            Cloudflare R2. The site is served from Cloudflare. We do not sell personal information.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-black">How long we keep it</h2>
          <p>
            We keep an account and its listing assignments until an administrator deletes them. You
            can ask us to delete your account by emailing{" "}
            <a className="underline" href="mailto:wfulghum@gmail.com">
              wfulghum@gmail.com
            </a>
            .
          </p>
        </section>
      </article>
      <Footer />
    </main>
  );
}
