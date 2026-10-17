import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { LoginForm } from "@/components/LoginForm";
import { getCurrentUser } from "@/lib/auth";
import { devAuthEnabled, googleAuthConfigured } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sign in · Aitch NYC",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const user = await getCurrentUser();
  const params = await searchParams;
  if (user) redirect(user.role === "super_admin" ? "/admin" : "/account");

  const nextPath =
    params.next && params.next.startsWith("/") && !params.next.startsWith("//") ? params.next : "";

  return (
    <main className="min-h-screen bg-white px-6 py-16 text-black">
      <div className="mb-12 flex justify-center">
        <Link href="/">
          <Image src="/aitchLogo.svg" alt="Aitch NYC" width={180} height={70} unoptimized />
        </Link>
      </div>
      <LoginForm
        devAuth={devAuthEnabled()}
        googleEnabled={googleAuthConfigured()}
        nextPath={nextPath}
        errorCode={params.error}
      />
    </main>
  );
}
