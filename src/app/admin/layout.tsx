import { redirect } from "next/navigation";
import { AppBar } from "@/components/AppBar";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "super_admin") redirect("/login?next=/admin");

  return (
    <div className="min-h-screen bg-white text-black">
      <AppBar user={user} />
      <div className="mx-auto max-w-6xl px-4 py-8">{children}</div>
    </div>
  );
}
