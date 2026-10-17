import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Privacy policy · Aitch NYC",
  description: "How Aitch NYC handles Google sign-in, client invitations, and private listing information.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white text-black">
      <Header />
      <article className="mx-auto max-w-3xl space-y-8 px-6 pb-24 pt-40 text-sm leading-7 text-neutral-800">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold text-black">Privacy policy</h1>
          <p className="text-neutral-500">Last updated October 16, 2026</p>
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
            Sign-in uses Google. When you sign in, we receive your name, email address, and whether
            Google has verified that email. We store that information so we can recognize you on
            later visits.
          </p>
          <p>
            Only the account administrators and clients they have invited can sign in. If Google
            confirms an email that has not been invited, we do not create an account and we do not
            show any listings.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-black">Listings</h2>
          <p>
            Administrators save listing details, including the address, unit, price, neighborhood,
            size, bedrooms, bathrooms, washer, description, sale or rental status, photos, and one
            video. Clients see only the listings an administrator has assigned to them.
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
