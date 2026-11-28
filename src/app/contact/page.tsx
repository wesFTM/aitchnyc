import Image from "next/image";
import { ContactForm } from "@/components/ContactForm";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { T } from "@/components/T";

export const metadata = {
  title: "Contact · Aitch NYC",
  description: "Contact Hyunhee Fulghum at Aitch NYC.",
};

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-neutral-50 text-black">
      <Header />
      <div className="mx-auto w-full max-w-5xl px-6 pb-20 pt-36">
        <T as="h1" id="contact.title" className="text-4xl font-semibold tracking-tight" />
        <T as="p" id="contact.intro" className="mt-3 max-w-xl text-sm leading-6 text-neutral-600" />
        <div className="mt-10 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
          <aside className="lg:col-start-2 lg:row-start-1">
            <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
              <Image
                src="/hyunhee-fulghum.jpg"
                alt="Hyunhee Fulghum"
                width={800}
                height={1000}
                className="aspect-[4/5] w-full object-cover object-top"
                priority
                unoptimized
              />
              <div className="space-y-1 px-5 py-5">
                <p className="text-lg font-semibold">Hyunhee Fulghum</p>
                <T as="p" id="contact.agentTitle" className="text-sm text-neutral-500" />
                <p className="pt-3 text-sm">
                  <a className="font-medium underline" href="tel:+16465040696">
                    646-504-0696
                  </a>
                </p>
                <p className="text-sm">
                  <a className="underline" href="mailto:hfulghum@findrealestate.com">
                    hfulghum@findrealestate.com
                  </a>
                </p>
              </div>
            </div>
          </aside>
          <div className="lg:col-start-1 lg:row-start-1">
            <ContactForm />
          </div>
        </div>
      </div>
      <Footer />
    </main>
  );
}
