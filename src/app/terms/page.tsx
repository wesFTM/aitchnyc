import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Terms of service · Aitch NYC",
  description: "Terms for using the Aitch NYC private listings site.",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-white text-black">
      <Header />
      <article className="mx-auto max-w-3xl space-y-8 px-6 pb-24 pt-40 text-sm leading-7 text-neutral-800">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold text-black">Terms of service</h1>
          <p className="text-neutral-500">Last updated October 16, 2026</p>
        </header>

        <p>
          These terms cover use of the Aitch NYC website. By signing in or viewing a listing, you
          agree to them.
        </p>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-black">Private listings</h2>
          <p>
            Listings are shared only with people an administrator has invited. If you are invited,
            the listings assigned to you are for you. Do not copy, forward, or publish them, the
            photos, or the video, unless an administrator agrees in writing.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-black">Your account</h2>
          <p>
            You sign in with the Google account whose email was invited. You are responsible for
            that Google account. An administrator can remove your access at any time.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-black">Listing information</h2>
          <p>
            Prices, availability, and other details can change or be withdrawn. A listing on this
            site is not an offer that can be accepted by itself, and it is not a promise that a
            property is still available.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-black">The site</h2>
          <p>
            The site is provided as it is. We may change or stop it. To the extent the law allows,
            we are not liable for lost access, errors in a listing, or decisions made from what you
            see here.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-black">Contact</h2>
          <p>
            Questions about these terms can be sent to{" "}
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
