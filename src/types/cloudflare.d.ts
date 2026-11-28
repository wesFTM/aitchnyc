interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T>(): Promise<{ results: T[] }>;
  first<T>(): Promise<T | null>;
  run(): Promise<unknown>;
}

interface D1Database {
  prepare(sql: string): D1PreparedStatement;
  exec(sql: string): Promise<unknown>;
}

interface R2ObjectBody {
  size: number;
  body: ReadableStream;
  arrayBuffer(): Promise<ArrayBuffer>;
}

interface R2Bucket {
  put(
    key: string,
    value: ArrayBuffer | Uint8Array,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>;
  get(
    key: string,
    options?: { range?: { offset: number; length: number } },
  ): Promise<R2ObjectBody | null>;
  head(key: string): Promise<{ size: number } | null>;
  delete(key: string): Promise<void>;
}

interface SendEmailBinding {
  send(message: {
    from: string | { email: string; name?: string };
    to: string | { email: string; name?: string };
    replyTo?: string | { email: string; name?: string };
    subject: string;
    text?: string;
    html?: string;
  }): Promise<{ messageId?: string }>;
}

interface CloudflareEnv {
  DB: D1Database;
  MEDIA: R2Bucket;
  EMAIL?: SendEmailBinding;
  BROWSER?: { fetch: typeof fetch };
  BRIGHTDATA_API_KEY?: string;
  BRIGHTDATA_API_TOKEN?: string;
  BRIGHTDATA_ZONE?: string;
  OXYLABS_USERNAME?: string;
  OXYLABS_PASSWORD?: string;
}
