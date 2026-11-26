import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { documentFileName, sniffDocument } from "@/lib/documents";
import { isUser, jsonError, requireDashboardUser } from "@/lib/http";
import { clientEditor, countClientDocuments, insertClientDocument, userCanSeeProperty } from "@/lib/queries";
import { deleteObject, putObject } from "@/lib/storage";
import type { User } from "@/lib/types";

export const runtime = "nodejs";

const MAX_BYTES = 20 * 1024 * 1024;
const MAX_DOCUMENTS = 40;

type RouteContext = { params: Promise<{ id: string }> };

function refresh(client: User, propertyId: string) {
  revalidatePath("/admin/clients");
  revalidatePath("/account");
  revalidatePath(`/properties/${propertyId}`);
  if (client.share_token) {
    revalidatePath(`/c/${client.share_token}`);
    revalidatePath(`/c/${client.share_token}/listings/${propertyId}`);
  }
}

export async function POST(request: Request, context: RouteContext) {
  const user = await requireDashboardUser();
  if (!isUser(user)) return user;
  const { id } = await context.params;
  const access = await clientEditor(user, id);
  if (access === "missing") return jsonError("Client not found.", 404);
  if (access === "forbidden") {
    return jsonError("That client is on the master list. Only a super admin can change it.", 403);
  }

  const form = await request.formData();
  const propertyId = form.get("propertyId");
  const file = form.get("file");
  if (typeof propertyId !== "string" || !propertyId) return jsonError("Choose a listing.");
  if (!(await userCanSeeProperty(user, propertyId))) return jsonError("Choose a listing from your list.");
  if (!(file instanceof File)) return jsonError("Choose a document.");
  if (file.size <= 0) return jsonError("That file is empty.");
  if (file.size > MAX_BYTES) return jsonError("Documents need to be 20MB or smaller.");
  if ((await countClientDocuments(id)) >= MAX_DOCUMENTS) {
    return jsonError(`A client can have up to ${MAX_DOCUMENTS} documents.`);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const sniffed = sniffDocument(bytes, file.name);
  if (!sniffed) return jsonError("Upload a PDF, Word, Excel, JPEG, PNG, WebP, or GIF file.");

  const documentId = crypto.randomUUID();
  const storageKey = `clients/${id}/documents/${documentId}`;
  const name = documentFileName(file.name);
  await putObject(storageKey, bytes, sniffed.contentType);
  try {
    await insertClientDocument({
      id: documentId,
      clientId: id,
      propertyId,
      storageKey,
      contentType: sniffed.contentType,
      originalName: name,
    });
  } catch (error) {
    await deleteObject(storageKey);
    throw error;
  }
  refresh(access.client, propertyId);
  return NextResponse.json({ id: documentId, name, propertyId });
}
