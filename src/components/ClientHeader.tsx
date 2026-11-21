import Image from "next/image";
import Link from "next/link";

export function ClientHeader({ href }: { href: string }) {
  return (
    <header className="border-b border-neutral-200 bg-white text-black">
      <div className="mx-auto flex h-14 max-w-6xl items-center px-4 sm:h-16">
        <Link href={href} className="shrink-0">
          <Image src="/aitchLogo.svg" alt="Aitch NYC" width={132} height={48} className="h-8 w-auto sm:h-12" unoptimized />
        </Link>
      </div>
    </header>
  );
}
