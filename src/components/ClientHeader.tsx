import Image from "next/image";
import Link from "next/link";

export function ClientHeader({ href }: { href: string }) {
  return (
    <header className="border-b border-neutral-200 bg-white text-black">
      <div className="mx-auto flex h-16 max-w-6xl items-center px-4">
        <Link href={href} className="shrink-0">
          <Image src="/aitchLogo.svg" alt="Aitch NYC" width={132} height={48} unoptimized />
        </Link>
      </div>
    </header>
  );
}
