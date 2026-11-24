import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { clearClientLogo, fetchCompanyLogo, saveClientLogo } from "@/lib/company-logo";
import { isUser, jsonError, requireDashboardUser, sniffMedia } from "@/lib/http";
import { respondWithMedia } from "@/lib/media-response";
import { adminCanViewClient, clientEditor, findUserById } from "@/lib/queries";
import { normalizeWebsite } from "@/lib/validators";
import type { User } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 2 * 1024 * 1024;

type RouteContext = { params: Promise<{ id: string }> };

function revalidateClient(client: User) {
  revalidatePath("/admin/clients");
  revalidatePath("/account");
  if (client.share_token) revalidatePath(`/c/${client.share_token}`);
}

async function clientFrom(context: RouteContext) {
  const user = await requireDashboardUser();
  if (!isUser(user)) return user;
  const { id } = await context.params;
  const access = await clientEditor(user, id);
  if (access === "missing") return jsonError("Client not found.", 404);
  if (access === "forbidden") {
    return jsonError("That client is on the master list. Only a super admin can change it.", 403);
  }
  return access.client;
}

export async function GET(request: Request, context: RouteContext) {
  const user = await requireDashboardUser();
  if (!isUser(user)) return user;
  const { id } = await context.params;
  const client = await findUserById(id);
  if (!client || client.role !== "client" || !client.logo_key || !client.logo_content_type) {
    return jsonError("File not found.", 404);
  }
  if (user.role === "admin" && !(await adminCanViewClient(user.id, client.id))) {
    return jsonError("File not found.", 404);
  }
  return respondWithMedia(request, client.logo_key, client.logo_content_type);
}

export async function POST(request: Request, context: RouteContext) {
  const client = await clientFrom(context);
  if (!isUser(client)) return client;

  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as { website?: unknown } | null;
    const website = normalizeWebsite(body?.website || client.company_website);
    if (typeof website !== "string") return jsonError(website.error);
    if (!website) return jsonError("Add a company website first.");
    const logo = await fetchCompanyLogo(website);
    if (!logo) return jsonError("Couldn't find a logo on that website. Upload one instead.");
    const logoKey = await saveClientLogo(client.id, client.logo_key, logo.bytes, logo.contentType);
    revalidateClient(client);
    return NextResponse.json({ logoKey });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return jsonError("Choose a logo image.");
  if (file.size <= 0) return jsonError("That file is empty.");
  if (file.size > MAX_BYTES) return jsonError("Logo images need to be 2MB or smaller.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const sniffed = sniffMedia(bytes);
  if (!sniffed || sniffed.kind !== "image") return jsonError("Upload a JPEG, PNG, WebP, or GIF.");
  const logoKey = await saveClientLogo(client.id, client.logo_key, bytes, sniffed.contentType);
  revalidateClient(client);
  return NextResponse.json({ logoKey });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const client = await clientFrom(context);
  if (!isUser(client)) return client;
  await clearClientLogo(client.id, client.logo_key);
  revalidateClient(client);
  return NextResponse.json({ ok: true });
}
