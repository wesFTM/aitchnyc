import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { isUser, jsonError, requireDashboardUser } from "@/lib/http";
import { respondWithMedia } from "@/lib/media-response";
import {
  adminCanViewClient,
  clientEditor,
  deleteClientDocument,
  getClientDocument,
  setClientDocumentListing,
  userCanSeeProperty,
} from "@/lib/queries";
import { deleteObject } from "@/lib/storage";
import type { User } from "@/lib/types";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string; docId: string }> };

function refresh(client: User, propertyId: string) {
  revalidatePath("/admin/clients");
  revalidatePath("/account");
  revalidatePath(`/properties/${propertyId}`);
  if (client.share_token) {
    revalidatePath(`/c/${client.share_token}`);
    revalidatePath(`/c/${client.share_token}/listings/${propertyId}`);
  }
}

async function ownedDocument(clientId: string, docId: string) {
  const document = await getClientDocument(docId);
  if (!document || document.client_id !== clientId) return null;
  return document;
}

export async function GET(request: Request, context: RouteContext) {
  const user = await requireDashboardUser();
  if (!isUser(user)) return user;
  const { id, docId } = await context.params;
  const document = await ownedDocument(id, docId);
  if (!document) return jsonError("File not found.", 404);
  if (user.role === "admin" && !(await adminCanViewClient(user.id, id))) return jsonError("File not found.", 404);
  if (user.role !== "super_admin" && user.role !== "admin") return jsonError("File not found.", 404);
  return respondWithMedia(request, document.storage_key, document.content_type, document.original_name);
}

export async function PATCH(request: Request, context: RouteContext) {
  const user = await requireDashboardUser();
  if (!isUser(user)) return user;
  const { id, docId } = await context.params;
  const access = await clientEditor(user, id);
  if (access === "missing") return jsonError("Client not found.", 404);
  if (access === "forbidden") {
    return jsonError("That client is on the master list. Only a super admin can change it.", 403);
  }
  const document = await ownedDocument(id, docId);
  if (!document) return jsonError("File not found.", 404);
  const body = (await request.json().catch(() => null)) as { propertyId?: unknown } | null;
  if (typeof body?.propertyId !== "string" || !body.propertyId) return jsonError("Choose a listing.");
  if (!(await userCanSeeProperty(user, body.propertyId))) return jsonError("Choose a listing from your list.");
  await setClientDocumentListing(document.id, body.propertyId);
  refresh(access.client, document.property_id);
  refresh(access.client, body.propertyId);
  return NextResponse.json({ ok: true, propertyId: body.propertyId });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await requireDashboardUser();
  if (!isUser(user)) return user;
  const { id, docId } = await context.params;
  const access = await clientEditor(user, id);
  if (access === "missing") return jsonError("Client not found.", 404);
  if (access === "forbidden") {
    return jsonError("That client is on the master list. Only a super admin can change it.", 403);
  }
  const document = await ownedDocument(id, docId);
  if (!document) return jsonError("File not found.", 404);
  const storageKey = await deleteClientDocument(document.id);
  if (storageKey) {
    try {
      await deleteObject(storageKey);
    } catch {
      // The record is already gone if the file was removed earlier.
    }
  }
  refresh(access.client, document.property_id);
  return NextResponse.json({ ok: true });
}
