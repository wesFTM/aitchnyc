import Image from "next/image";
import Link from "next/link";
import type { User } from "@/lib/types";

export function AppBar({ user }: { user: User }) {
  const admin = user.role === "super_admin";

  return (
    <header className="border-b border-neutral-200 bg-white text-black">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:h-16 sm:flex-nowrap sm:py-0">
        <Link href={admin ? "/admin" : "/account"} className="shrink-0">
          <Image src="/aitchLogo.svg" alt="Aitch NYC" width={132} height={48} className="h-8 w-auto sm:h-12" unoptimized />
        </Link>
        <nav className="order-3 flex w-full min-w-0 items-center gap-4 text-sm font-semibold sm:order-none sm:w-auto sm:flex-1 sm:gap-5">
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
        <div className="ml-auto flex min-w-0 items-center gap-3 text-sm sm:ml-0">
          <span className="hidden truncate text-neutral-500 sm:inline">{user.name}</span>
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
