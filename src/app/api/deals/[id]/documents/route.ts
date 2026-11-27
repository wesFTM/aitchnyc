import { NextResponse } from "next/server";
import { documentFileName, sniffDocument } from "@/lib/documents";
import { isUser, jsonError, requireDashboardUser } from "@/lib/http";
import { countDealDocuments, dealEditor, insertDealDocument } from "@/lib/queries";
import { revalidateDealClient } from "@/lib/revalidate-deal";
import { deleteObject, putObject } from "@/lib/storage";

export const runtime = "nodejs";

const MAX_BYTES = 20 * 1024 * 1024;
const MAX_DOCUMENTS = 40;

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const user = await requireDashboardUser();
  if (!isUser(user)) return user;
  const { id } = await context.params;
  const access = await dealEditor(user, id);
  if (access === "missing") return jsonError("Deal not found.", 404);
  if (access === "forbidden") return jsonError("You can't change that deal.", 403);

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return jsonError("Choose a document.");
  if (file.size <= 0) return jsonError("That file is empty.");
  if (file.size > MAX_BYTES) return jsonError("Documents need to be 20MB or smaller.");
  if ((await countDealDocuments(id)) >= MAX_DOCUMENTS) {
    return jsonError(`A deal can have up to ${MAX_DOCUMENTS} documents.`);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const sniffed = sniffDocument(bytes, file.name);
  if (!sniffed) return jsonError("Upload a PDF, Word, Excel, JPEG, PNG, WebP, or GIF file.");

  const documentId = crypto.randomUUID();
  const storageKey = `deals/${id}/documents/${documentId}`;
  const name = documentFileName(file.name);
  await putObject(storageKey, bytes, sniffed.contentType);
  try {
    await insertDealDocument({
      id: documentId,
      dealId: id,
      storageKey,
      contentType: sniffed.contentType,
      originalName: name,
    });
  } catch (error) {
    await deleteObject(storageKey);
    throw error;
  }
  await revalidateDealClient(access.deal.client_id);
  return NextResponse.json({ id: documentId, name });
}
