import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import type { User } from "@/lib/types";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function requireAdmin(): Promise<User | NextResponse> {
  const user = await getCurrentUser();
  if (!user || user.role !== "super_admin") {
    return jsonError("Sign in as an admin to do that.", 401);
  }
  return user;
}

export function isUser(value: User | NextResponse): value is User {
  return !(value instanceof NextResponse);
}

const IMAGE_TYPES: Record<string, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

export function sniffMedia(bytes: Uint8Array): { kind: "image" | "video"; contentType: string } | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { kind: "image", contentType: IMAGE_TYPES.jpeg };
  }
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { kind: "image", contentType: IMAGE_TYPES.png };
  }
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
    return { kind: "image", contentType: IMAGE_TYPES.gif };
  }
  const riff = String.fromCharCode(...bytes.slice(0, 4));
  const webp = String.fromCharCode(...bytes.slice(8, 12));
  if (riff === "RIFF" && webp === "WEBP") {
    return { kind: "image", contentType: IMAGE_TYPES.webp };
  }
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return { kind: "video", contentType: "video/webm" };
  }
  const box = String.fromCharCode(...bytes.slice(4, 8));
  if (box === "ftyp") {
    const brand = String.fromCharCode(...bytes.slice(8, 12));
    if (brand === "qt  ") return { kind: "video", contentType: "video/quicktime" };
    return { kind: "video", contentType: "video/mp4" };
  }
  return null;
}
