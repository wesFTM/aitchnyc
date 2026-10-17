import Image from "next/image";
import Link from "next/link";
import type { User } from "@/lib/types";

export function AppBar({ user }: { user: User }) {
  const admin = user.role === "super_admin";

  return (
    <header className="border-b border-neutral-200 bg-white text-black">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <Link href={admin ? "/admin" : "/account"} className="shrink-0">
            <Image src="/aitchLogo.svg" alt="Aitch NYC" width={132} height={48} unoptimized />
          </Link>
          <nav className="flex items-center gap-5 text-sm font-semibold">
            {admin ? (
              <>
                <Link href="/admin" className="hover:underline">
                  Dashboard
                </Link>
                <Link href="/admin/clients" className="hover:underline">
                  Clients
                </Link>
              </>
            ) : (
              <Link href="/account" className="hover:underline">
                Your listings
              </Link>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="hidden text-neutral-500 sm:inline">{user.name}</span>
          <form action="/api/auth/logout" method="post">
            <button className="font-semibold hover:underline" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
