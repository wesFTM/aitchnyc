export function clientLogoUrl(token: string | null, logoKey: string | null) {
  if (!token || !logoKey) return null;
  return `/api/c/${token}/logo?v=${encodeURIComponent(logoKey)}`;
}
