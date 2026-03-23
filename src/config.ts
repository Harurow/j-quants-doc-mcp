import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface SpecConfig {
  base_url: string;
  default_language: string;
  endpoints: { list_page: string };
  cache_ttl_seconds: number;
  external_links: Record<string, string>;
  v1: {
    base_url: string;
    endpoints: { list_page: string };
  };
}

let _config: SpecConfig | null = null;

export function loadConfig(): SpecConfig {
  if (!_config) {
    const raw = readFileSync(join(__dirname, "data", "spec_config.json"), "utf-8");
    _config = JSON.parse(raw) as SpecConfig;
  }
  // 環境変数で base_url を上書き
  if (process.env.JQUANTS_BASE_URL) {
    _config.base_url = process.env.JQUANTS_BASE_URL;
  }
  return _config;
}

export const DATA_DIR = join(__dirname, "data");
