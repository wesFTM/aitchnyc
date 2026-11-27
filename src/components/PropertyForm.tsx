"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { AMENITY_FIELDS, amenityLabel, emptyAmenities, parseAmenities } from "@/lib/amenities";
import { TypeDeleteDialog } from "@/components/TypeDeleteDialog";
import { useI18n } from "@/components/LanguageProvider";
import { sendJson } from "@/lib/client-api";
import { ListingStatusControl } from "@/components/ListingStatusControl";
import { LISTING_TYPE_OPTIONS, displayStatus, dollarsInputValue, listingTypeLabel } from "@/lib/format";
import { NEIGHBORHOODS, buttonClass, fieldClass, labelClass } from "@/lib/styles";
import type { ListingStatus, ListingType, Property } from "@/lib/types";

type Props = {
  property?: Property;
  actionsHostId?: string;
  allowDelete?: boolean;
};

const LISTING_FORM_ID = "listing-form";
const savedSnapshots = new Map<string, string>();

function formSnapshot(value: unknown) {
  return JSON.stringify(value);
}

const empty = {
  address: "",
  unit: "",
  price: "",
  listingType: null as ListingType | null,
  neighborhood: "",
  sqft: "",
  sqftOptional: "",
  bedrooms: "",
  bathrooms: "",
  amenities: emptyAmenities(),
  description: "",
  status: "active" as ListingStatus,
  keyMoney: "0",
  possession: "",
  terms: "",
  frontage: "",
  ceilingHeight: "",
  neighboringTenants: "",
};

export function PropertyForm({ property, actionsHostId, allowDelete = true }: Props) {
  const router = useRouter();
  const { locale, t } = useI18n();
  const [actionsHost, setActionsHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!actionsHostId) return;
    setActionsHost(document.getElementById(actionsHostId));
  }, [actionsHostId]);
  const [values, setValues] = useState(() =>
    property
      ? {
          address: property.address,
          unit: property.unit || "",
          price:
            property.listing_type === "commercial" && property.price_cents <= 0
              ? ""
              : dollarsInputValue(property.price_cents),
          listingType: property.listing_type,
          neighborhood: property.neighborhood,
          sqft: property.sqft?.toString() || "",
          sqftOptional: property.sqft_optional?.toString() || "",
          bedrooms: property.bedrooms?.toString() || "",
          bathrooms: property.bathrooms?.toString() || "",
          amenities: parseAmenities(property.amenities),
          description: property.description,
          status: displayStatus(property),
          keyMoney: dollarsInputValue(property.key_money_cents ?? 0),
          possession: property.possession || "",
          terms: property.terms || "",
          frontage: property.frontage || "",
          ceilingHeight: property.ceiling_height || "",
          neighboringTenants: property.neighboring_tenants || "",
        }
      : empty,
  );
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function update<K extends keyof typeof values>(key: K, value: (typeof values)[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function changeType(listingType: ListingType) {
    setValues((current) => ({ ...current, listingType }));
  }

  function rememberStatus(status: ListingStatus) {
    if (property) {
      const raw = savedSnapshots.get(property.id);
      if (raw) {
        const saved = JSON.parse(raw) as typeof values;
        savedSnapshots.set(property.id, formSnapshot({ ...saved, status }));
      }
    }
    setValues((current) => ({ ...current, status }));
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!values.listingType) return;
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const payload = { ...values, listingType: values.listingType };
      if (property) {
        const result = await sendJson<{ geocoded: boolean }>(`/api/properties/${property.id}`, "PATCH", payload);
        savedSnapshots.set(property.id, formSnapshot(values));
        setNotice(result.geocoded ? t("form.savedNotice") : t("form.savedUnmapped"));
        router.refresh();
      } else {
        const result = await sendJson<{ id: string; geocoded: boolean }>("/api/properties", "POST", payload);
        router.push(result.geocoded ? `/admin/properties/${result.id}` : `/admin/properties/${result.id}?placed=0`);
        router.refresh();
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("form.saveFailed"));
    } finally {
      setPending(false);
    }
  }

  async function onDelete() {
    if (!property) return;
    setConfirmingDelete(false);
    setPending(true);
    setError(null);
    try {
      await sendJson(`/api/properties/${property.id}`, "DELETE");
      router.push("/admin");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("form.deleteFailed"));
      setPending(false);
    }
  }

  const listingType = values.listingType;
  const commercial = listingType === "commercial";
  const saved = property != null && savedSnapshots.get(property.id) === formSnapshot(values);

  const headerButton =
    "inline-flex min-w-0 items-center justify-center gap-2 rounded-full px-1 py-3 text-center text-xs font-semibold leading-tight text-white disabled:opacity-50 sm:px-2 sm:text-sm";
  const actions = (
    <div className={actionsHost ? "contents" : "flex flex-wrap items-center gap-3"}>
      <button
        className={
          actionsHost
            ? `${headerButton} ${saved ? "bg-green-600 hover:bg-green-700" : "bg-black hover:bg-neutral-800"}`
            : saved
              ? "inline-flex items-center justify-center gap-2 rounded-full bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              : buttonClass
        }
        type="submit"
        form={actionsHost ? LISTING_FORM_ID : undefined}
        disabled={pending}
      >
        {pending ? (
          t("form.saving")
        ) : saved ? (
          <>
            <Check className="h-4 w-4" aria-hidden />
            {t("form.saved")}
          </>
        ) : property ? (
          t("form.saveListing")
        ) : (
          t("form.createListing")
        )}
      </button>
      {property && allowDelete && (
        <button
          className={
            actionsHost
              ? `${headerButton} bg-red-600 hover:bg-red-700`
              : "inline-flex items-center justify-center rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          }
          type="button"
          onClick={() => setConfirmingDelete(true)}
          disabled={pending}
        >
          {t("form.deleteListing")}
        </button>
      )}
    </div>
  );
  const actionsInHeader = Boolean(actionsHostId);

  return (
    <>
    <form id={actionsInHeader ? LISTING_FORM_ID : undefined} onSubmit={onSubmit} className="space-y-5">
      <div className="@container min-w-0">
        <div className="grid min-w-0 grid-cols-1 gap-2 @min-[40rem]:grid-cols-3 @min-[40rem]:gap-3">
          <div className="flex min-w-0 gap-2 @min-[40rem]:col-span-2 @min-[40rem]:gap-3">
            {LISTING_TYPE_OPTIONS.map((type) => {
              const selected = values.listingType === type.id;
              return (
                <button
                  key={type.id}
                  type="button"
                  aria-pressed={selected}
                  className={`inline-flex min-w-max flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-3 text-center text-sm font-semibold ${
                    selected ? "border-green-600 bg-green-600 text-white" : "border-neutral-300 bg-white"
                  }`}
                  onClick={() => changeType(type.id)}
                >
                  {selected && <Check className="h-4 w-4 shrink-0" aria-hidden />}
                  {listingTypeLabel(type.id, locale)}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {listingType && (
      <>
      <label className="block">
        <span className={labelClass}>{t("form.address")}</span>
        <input
          className={fieldClass}
          value={values.address}
          onChange={(event) => update("address", event.target.value)}
          placeholder="538 E 14th St"
          required
        />
        <span className="mt-1 block text-xs text-neutral-500">
          {t("form.addressHelp")}
        </span>
      </label>

      <div className="space-y-2">
        <span className={labelClass}>{t("form.status")}</span>
        <ListingStatusControl
          propertyId={property?.id}
          status={values.status}
          onChange={rememberStatus}
          size="md"
        />
        <p className="text-xs text-neutral-500">
          {property ? t("form.statusSaved") : t("form.statusChoose")}
        </p>
      </div>

      {commercial ? (
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>{t("form.unit")}</span>
            <input className={fieldClass} value={values.unit} onChange={(event) => update("unit", event.target.value)} />
          </label>
          <label className="block">
            <span className={labelClass}>{t("form.askingRent")}</span>
            <input
              className={fieldClass}
              inputMode="decimal"
              value={values.price}
              onChange={(event) => update("price", event.target.value)}
              placeholder={t("price.uponRequest")}
            />
          </label>
          <label className="block">
            <span className={labelClass}>{t("form.keyMoney")}</span>
            <input
              className={fieldClass}
              inputMode="decimal"
              value={values.keyMoney}
              onChange={(event) => update("keyMoney", event.target.value)}
              placeholder="25000"
            />
          </label>
          <label className="block">
            <span className={labelClass}>{t("form.neighborhood")}</span>
            <input
              className={fieldClass}
              list="neighborhoods"
              value={values.neighborhood}
              onChange={(event) => update("neighborhood", event.target.value)}
            />
            <datalist id="neighborhoods">
              {NEIGHBORHOODS.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </label>
          <label className="block">
            <span className={labelClass}>{t("form.sqftGround")}</span>
            <input
              className={fieldClass}
              inputMode="numeric"
              value={values.sqft}
              onChange={(event) => update("sqft", event.target.value)}
            />
          </label>
          <label className="block">
            <span className={labelClass}>{t("form.totalSqft")}</span>
            <input
              className={fieldClass}
              inputMode="numeric"
              value={values.sqftOptional}
              onChange={(event) => update("sqftOptional", event.target.value)}
            />
          </label>
          <label className="block">
            <span className={labelClass}>{t("form.possession")}</span>
            <input
              className={fieldClass}
              value={values.possession}
              onChange={(event) => update("possession", event.target.value)}
              placeholder={t("form.immediate")}
            />
          </label>
          <label className="block">
            <span className={labelClass}>{t("form.terms")}</span>
            <input
              className={fieldClass}
              value={values.terms}
              onChange={(event) => update("terms", event.target.value)}
              placeholder="5 years"
            />
          </label>
          <label className="block">
            <span className={labelClass}>{t("form.frontage")}</span>
            <input
              className={fieldClass}
              value={values.frontage}
              onChange={(event) => update("frontage", event.target.value)}
              placeholder="25 ft"
            />
          </label>
          <label className="block">
            <span className={labelClass}>{t("form.ceiling")}</span>
            <input
              className={fieldClass}
              value={values.ceilingHeight}
              onChange={(event) => update("ceilingHeight", event.target.value)}
              placeholder="12 ft"
            />
          </label>
        </div>
      ) : (
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>{t("form.unitNumber")}</span>
            <input className={fieldClass} value={values.unit} onChange={(event) => update("unit", event.target.value)} />
          </label>
          <label className="block">
            <span className={labelClass}>{listingType === "rental" ? t("form.monthlyRent") : t("form.price")}</span>
            <input
              className={fieldClass}
              inputMode="decimal"
              value={values.price}
              onChange={(event) => update("price", event.target.value)}
              placeholder={listingType === "rental" ? "4500" : "1250000"}
              required
            />
          </label>
          <label className="block">
            <span className={labelClass}>{t("form.neighborhood")}</span>
            <input
              className={fieldClass}
              list="neighborhoods"
              value={values.neighborhood}
              onChange={(event) => update("neighborhood", event.target.value)}
            />
            <datalist id="neighborhoods">
              {NEIGHBORHOODS.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </label>
          <label className="block">
            <span className={labelClass}>{t("form.squareFootage")}</span>
            <input
              className={fieldClass}
              inputMode="numeric"
              value={values.sqft}
              onChange={(event) => update("sqft", event.target.value)}
            />
          </label>
          <label className="block">
            <span className={labelClass}>{t("form.bedrooms")}</span>
            <input
              className={fieldClass}
              inputMode="numeric"
              value={values.bedrooms}
              onChange={(event) => update("bedrooms", event.target.value)}
            />
          </label>
          <label className="block">
            <span className={labelClass}>{t("form.bathrooms")}</span>
            <input
              className={fieldClass}
              inputMode="decimal"
              value={values.bathrooms}
              onChange={(event) => update("bathrooms", event.target.value)}
            />
          </label>
        </div>
      )}

      {!commercial && (
        <fieldset>
          <legend className={labelClass}>{t("form.amenities")}</legend>
          <div className="grid min-w-0 gap-2 sm:grid-cols-2">
            {AMENITY_FIELDS.map((field) => (
              <label key={field.key} className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-black"
                  checked={values.amenities[field.key]}
                  onChange={(event) =>
                    update("amenities", { ...values.amenities, [field.key]: event.target.checked })
                  }
                />
                {amenityLabel(field.key, locale)}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <label className="block">
        <span className={labelClass}>{commercial ? t("form.comments") : t("form.description")}</span>
        <textarea
          className={`${fieldClass} min-h-32`}
          value={values.description}
          onChange={(event) => update("description", event.target.value)}
        />
      </label>

      {commercial && (
        <label className="block">
          <span className={labelClass}>{t("form.neighbors")}</span>
          <textarea
            className={`${fieldClass} min-h-32`}
            value={values.neighboringTenants}
            onChange={(event) => update("neighboringTenants", event.target.value)}
          />
        </label>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {notice && <p className="text-sm text-neutral-700">{notice}</p>}

      {actionsHost ? createPortal(actions, actionsHost) : actionsInHeader ? null : actions}
      </>
      )}
    </form>
    {confirmingDelete && property && (
      <TypeDeleteDialog
        title={t("form.deleteTitle")}
        description={t("form.deleteBody")}
        pending={pending}
        onCancel={() => {
          if (!pending) setConfirmingDelete(false);
        }}
        onConfirm={onDelete}
      />
    )}
    </>
  );
}
