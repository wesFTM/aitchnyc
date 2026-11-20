export function newShareToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function isShareToken(value: string) {
  return /^[a-f0-9]{32}$/.test(value);
}
