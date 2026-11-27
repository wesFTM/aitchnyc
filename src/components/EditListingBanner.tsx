"use client";

import { T } from "@/components/T";
import { useI18n } from "@/components/LanguageProvider";
import { formatTourWhen } from "@/lib/format";

export function EditListingBanner({
  address,
  interested,
  imported,
  photos,
  placed,
  showAdminNote,
}: {
  address: string;
  interested: { id: string; name: string; tour_requested: number; tour_scheduled_at: string | null }[];
  imported?: string;
  photos?: string;
  placed?: string;
  showAdminNote: boolean;
}) {
  const { locale, t } = useI18n();
  const scheduled = interested.filter((client) => client.tour_requested && client.tour_scheduled_at);
  const requested = interested.filter((client) => client.tour_requested && !client.tour_scheduled_at);
  const liked = interested.filter((client) => !client.tour_requested);

  return (
    <div className="space-y-4">
      <div>
        <T as="p" className="text-xs font-semibold uppercase tracking-wide text-neutral-500" id="admin.editListing" />
        <h1 className="mt-1 break-words text-3xl font-semibold">{address}</h1>
        {scheduled.map((client) => (
          <p key={client.id} className="mt-2 text-sm font-medium text-green-700">
            {t("admin.tourWith", {
              name: client.name,
              when: formatTourWhen(client.tour_scheduled_at || "", locale),
            })}
          </p>
        ))}
        {requested.length > 0 && (
          <p className="mt-2 text-sm font-medium text-green-700">
            {t("admin.tourRequestedBy", { names: requested.map((client) => client.name).join(", ") })}
          </p>
        )}
        {liked.length > 0 && (
          <p className="mt-2 text-sm text-neutral-600">
            {t("admin.likedBy", { names: liked.map((client) => client.name).join(", ") })}
          </p>
        )}
      </div>
      {imported === "1" && (
        <p className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-800">
          {t("admin.imported")}
          {photos === "0" ? t("admin.importedNoPhotos") : t("admin.photosSaved")}
          {t("admin.importedTail")}
        </p>
      )}
      {placed === "0" && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{t("admin.unplaced")}</p>
      )}
      {showAdminNote && (
        <p className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">{t("admin.adminSaveNote")}</p>
      )}
    </div>
  );
}
