"use client";

import type { ElementType } from "react";
import { useI18n } from "@/components/LanguageProvider";
import type { MessageKey } from "@/lib/messages";

export function T({
  id,
  values,
  className,
  as: Tag = "span",
}: {
  id: MessageKey;
  values?: Record<string, string | number>;
  className?: string;
  as?: ElementType;
}) {
  const { t } = useI18n();
  return <Tag className={className}>{t(id, values)}</Tag>;
}
