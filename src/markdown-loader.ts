import { loadConfig } from "./config.js";

interface CacheEntry {
  content: string;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();

function isCacheValid(key: string, ttl: number): boolean {
  const entry = cache.get(key);
  if (!entry) return false;
  return Date.now() / 1000 - entry.timestamp < ttl;
}

async function fetchMarkdown(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "J-Quants-Doc-MCP/1.0" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    if (res.status === 404) {
      throw new NotFoundError(`Page not found: ${url}`);
    }
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${url}`);
  }
  return res.text();
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

// --- V2 ---

export async function loadEndpointList(language?: string) {
  const config = loadConfig();
  const lang = language ?? config.default_language;
  const baseUrl = config.base_url;
  const listPage = config.endpoints.list_page;
  const ttl = config.cache_ttl_seconds;

  const fetchUrl = `${baseUrl}/${lang}${listPage}.md`;
  const userUrl = `${baseUrl}/${lang}${listPage}`;
  const cacheKey = `list_${lang}`;

  if (isCacheValid(cacheKey, ttl)) {
    return { content: cache.get(cacheKey)!.content, source_url: userUrl, cached: true };
  }

  const content = await fetchMarkdown(fetchUrl);
  cache.set(cacheKey, { content, timestamp: Date.now() / 1000 });
  return { content, source_url: userUrl, cached: false };
}

export async function loadSpecPage(path: string, language?: string) {
  const config = loadConfig();
  const lang = language ?? config.default_language;
  const baseUrl = config.base_url;
  const ttl = config.cache_ttl_seconds;

  const normalized = path.replace(/^\//, "");
  const fetchUrl = `${baseUrl}/${lang}/${normalized}.md`;
  const userUrl = `${baseUrl}/${lang}/${normalized}`;
  const cacheKey = `spec_${lang}_${normalized.replace(/\//g, "_")}`;

  if (isCacheValid(cacheKey, ttl)) {
    return { content: cache.get(cacheKey)!.content, source_url: userUrl, path, cached: true };
  }

  const content = await fetchMarkdown(fetchUrl);
  cache.set(cacheKey, { content, timestamp: Date.now() / 1000 });
  return { content, source_url: userUrl, path, cached: false };
}

export async function loadEndpointDetail(endpointName: string, language?: string) {
  const result = await loadSpecPage(`/spec/${endpointName}`, language);
  return { ...result, endpoint_name: endpointName };
}

// --- V1 ---

export async function loadV1EndpointList() {
  const config = loadConfig();
  const v1 = config.v1;
  const ttl = config.cache_ttl_seconds;

  const fetchUrl = `${v1.base_url}${v1.endpoints.list_page}.md`;
  const userUrl = `${v1.base_url}${v1.endpoints.list_page}`;
  const cacheKey = "v1_list";

  if (isCacheValid(cacheKey, ttl)) {
    return { content: cache.get(cacheKey)!.content, source_url: userUrl, cached: true };
  }

  const content = await fetchMarkdown(fetchUrl);
  cache.set(cacheKey, { content, timestamp: Date.now() / 1000 });
  return { content, source_url: userUrl, cached: false };
}

export async function loadV1EndpointDetail(endpointName: string) {
  const config = loadConfig();
  const v1 = config.v1;
  const ttl = config.cache_ttl_seconds;

  const normalized = endpointName.replace(/^\//, "");
  const fetchUrl = `${v1.base_url}${v1.endpoints.list_page}/${normalized}.md`;
  const userUrl = `${v1.base_url}${v1.endpoints.list_page}/${normalized}`;
  const cacheKey = `v1_spec_${normalized.replace(/\//g, "_")}`;

  if (isCacheValid(cacheKey, ttl)) {
    return {
      content: cache.get(cacheKey)!.content,
      source_url: userUrl,
      endpoint_name: endpointName,
      cached: true,
    };
  }

  const content = await fetchMarkdown(fetchUrl);
  cache.set(cacheKey, { content, timestamp: Date.now() / 1000 });
  return { content, source_url: userUrl, endpoint_name: endpointName, cached: false };
}

// --- External links ---

export function getExternalLinks(language?: string): Record<string, string> {
  const config = loadConfig();
  const lang = language ?? config.default_language;
  const baseUrl = config.base_url;
  const links: Record<string, string> = {};
  for (const [key, path] of Object.entries(config.external_links)) {
    links[key] = `${baseUrl}/${lang}${path}`;
  }
  return links;
}

export function clearCache(): void {
  cache.clear();
}
