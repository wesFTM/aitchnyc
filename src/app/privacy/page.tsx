import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { PrivacyArticle } from "@/components/LegalArticles";

export const metadata: Metadata = {
  title: "Privacy policy · Aitch NYC",
  description: "How Aitch NYC handles administrator sign-in, client page links, and private listing information.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white text-black">
      <Header />
      <PrivacyArticle />
      <Footer />
    </main>
  );
}
