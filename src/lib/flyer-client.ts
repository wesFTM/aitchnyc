import { addressFromFilename, parseListingFlyer, type SetupDraft, type SetupTextItem } from "@/lib/meridian-listing";

const MAX_IMAGE_EDGE = 1400;
const MAX_LISTING_IMAGES = 8;

export type FlyerRead = {
  draft: SetupDraft;
  images: Blob[];
};

async function scaledJpeg(data: Uint8Array, width: number, height: number) {
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(width, height));
  const nextWidth = Math.max(1, Math.round(width * scale));
  const nextHeight = Math.max(1, Math.round(height * scale));
  const source = document.createElement("canvas");
  source.width = width;
  source.height = height;
  const sourceContext = source.getContext("2d");
  const canvas = document.createElement("canvas");
  canvas.width = nextWidth;
  canvas.height = nextHeight;
  const context = canvas.getContext("2d");
  if (!sourceContext || !context) return null;
  sourceContext.putImageData(new ImageData(new Uint8ClampedArray(data), width, height), 0, 0);
  context.drawImage(source, 0, 0, nextWidth, nextHeight);
  source.width = 0;
  source.height = 0;
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.74));
}

export async function readFlyer(bytes: Uint8Array, sourceName = ""): Promise<FlyerRead> {
  const { extractImages, extractTextItems, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(bytes, {
    isOffscreenCanvasSupported: false,
    isImageDecoderSupported: false,
  });
  try {
    const extracted = await extractTextItems(pdf);
    const pages = extracted.items.map((page) =>
      page.map(
        (item): SetupTextItem => ({
          str: item.str,
          x: item.x,
          y: item.y,
          width: item.width,
          fontSize: item.fontSize,
        }),
      ),
    );
    const draft = parseListingFlyer(pages);
    if (!draft.address && sourceName) draft.address = addressFromFilename(sourceName);
    if (!draft.address) throw new Error("Couldn't find an address in that PDF.");

    const images: Blob[] = [];
    const seen = new Set<string>();
    for (let page = 1; page <= pdf.numPages && images.length < MAX_LISTING_IMAGES; page += 1) {
      let found: Awaited<ReturnType<typeof extractImages>> = [];
      try {
        found = await extractImages(pdf, page);
      } catch {
        continue;
      }
      for (const image of found) {
        if (images.length >= MAX_LISTING_IMAGES) break;
        if (image.width < 400 || image.height < 400 || image.data.byteLength < 8) continue;
        const id = image.key || `${page}:${image.width}x${image.height}`;
        if (seen.has(id)) continue;
        seen.add(id);
        try {
          const pixels = image.data.subarray(0, image.width * image.height * 4);
          const jpeg = await scaledJpeg(pixels, image.width, image.height);
          if (jpeg && jpeg.size > 8) images.push(jpeg);
        } catch {
          // Skip a photo that cannot be scaled.
        }
      }
    }
    return { draft, images };
  } finally {
    const destroy = (pdf as { destroy?: () => Promise<void> }).destroy?.bind(pdf);
    if (destroy) await destroy().catch(() => undefined);
  }
}
