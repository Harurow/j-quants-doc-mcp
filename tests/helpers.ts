import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "fixtures");

export function readFixture(name: string): string {
  return readFileSync(join(FIXTURES_DIR, name), "utf-8");
}

/**
 * fetch のモックレスポンスを作成する。
 */
export function mockFetchOk(content: string): typeof globalThis.fetch {
  return async () =>
    new Response(content, { status: 200, headers: { "Content-Type": "text/markdown" } });
}

export function mockFetch404(): typeof globalThis.fetch {
  return async () => new Response("Not Found", { status: 404 });
}

export function mockFetchError(): typeof globalThis.fetch {
  return async () => {
    throw new TypeError("fetch failed");
  };
}
