export function cloudflareBindingsEnabled() {
  return (
    process.env.USE_CLOUDFLARE_BINDINGS === "1" ||
    (typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers")
  );
}
