import "server-only";

import path from "node:path";

const globalForMedia = globalThis as unknown as {
  mediaBucket?: Promise<R2Bucket>;
};

async function openMediaBucket(): Promise<R2Bucket> {
  if (process.env.USE_CLOUDFLARE_BINDINGS === "1") {
    const loaded = (await new Function("specifier", "return import(specifier)")(
      "@opennextjs/cloudflare",
    )) as {
      getCloudflareContext: (options?: { async?: boolean }) => Promise<{ env: { MEDIA?: R2Bucket } }>;
    };
    const { env } = await loaded.getCloudflareContext({ async: true });
    if (!env.MEDIA) throw new Error("The MEDIA R2 binding is missing.");
    return env.MEDIA;
  }

  const { getPlatformProxy } = await import("wrangler");
  const proxy = await getPlatformProxy<{ MEDIA: R2Bucket }>({
    configPath: path.join(process.cwd(), "wrangler.jsonc"),
  });
  if (!proxy.env.MEDIA) {
    throw new Error("The MEDIA R2 binding is missing from wrangler.jsonc.");
  }
  return proxy.env.MEDIA;
}

function mediaBucket() {
  if (!globalForMedia.mediaBucket) {
    globalForMedia.mediaBucket = openMediaBucket().catch((error: unknown) => {
      globalForMedia.mediaBucket = undefined;
      const message = error instanceof Error ? error.message : "unknown error";
      throw new Error(
        `Couldn't reach the aitchnyc-media R2 bucket. Check \`npx wrangler login\` and wrangler.jsonc. ${message}`,
      );
    });
  }
  return globalForMedia.mediaBucket;
}

export async function putObject(key: string, bytes: Uint8Array, contentType: string) {
  const bucket = await mediaBucket();
  await bucket.put(key, bytes, { httpMetadata: { contentType } });
}

export async function deleteObject(key: string) {
  const bucket = await mediaBucket();
  await bucket.delete(key);
}

export async function objectSize(key: string): Promise<number | null> {
  const bucket = await mediaBucket();
  const head = await bucket.head(key);
  return head?.size ?? null;
}

export async function readObject(
  key: string,
  start: number,
  endInclusive: number,
): Promise<Uint8Array | null> {
  const length = endInclusive - start + 1;
  if (length <= 0) return null;
  const bucket = await mediaBucket();
  const object = await bucket.get(key, { range: { offset: start, length } });
  if (!object) return null;
  return new Uint8Array(await object.arrayBuffer());
}
