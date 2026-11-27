import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { TermsArticle } from "@/components/LegalArticles";

export const metadata: Metadata = {
  title: "Terms of service · Aitch NYC",
  description: "Terms for using the Aitch NYC private listings site.",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-white text-black">
      <Header />
      <TermsArticle />
      <Footer />
    </main>
  );
}
