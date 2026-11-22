"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { User } from "@/lib/types";

function pillClass(selected: boolean) {
  const shared =
    "mt-[2.6px] mr-1.5 inline-flex shrink-0 items-center justify-center rounded-full border border-black px-[13.8px] pt-[5.06px] pb-[4.6px] text-[13.8px] leading-[18.4px] font-semibold";
  return selected ? `${shared} bg-black text-white` : `${shared} bg-white text-black`;
}

export function AppBar({ user }: { user: User }) {
  const admin = user.role === "super_admin";
  const pathname = usePathname();
  const clientsSelected = pathname === "/admin/clients" || pathname.startsWith("/admin/clients/");
  const dashboardSelected = !clientsSelected && (pathname === "/admin" || pathname.startsWith("/admin/"));

  return (
    <header className="border-b border-neutral-200 bg-white text-black">
      <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 md:h-16 md:flex-nowrap md:py-0">
        <Link href={admin ? "/admin" : "/account"} className="shrink-0">
          <Image src="/aitchLogo.svg" alt="Aitch NYC" width={132} height={48} className="h-8 w-auto sm:h-12" unoptimized />
        </Link>
        <nav className="order-3 flex w-full min-w-0 flex-wrap items-center gap-2 md:order-none md:w-auto md:flex-1">
          {admin ? (
            <>
              <Link href="/admin" className={pillClass(dashboardSelected)} aria-current={dashboardSelected ? "page" : undefined}>
                Dashboard
              </Link>
              <Link href="/admin/clients" className={pillClass(clientsSelected)} aria-current={clientsSelected ? "page" : undefined}>
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
          <span className="hidden max-w-40 truncate text-neutral-500 md:inline">{user.name}</span>
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
