import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  loadEndpointList,
  loadSpecPage,
  loadEndpointDetail,
  loadV1EndpointList,
  loadV1EndpointDetail,
  getExternalLinks,
  clearCache,
  NotFoundError,
} from "../src/markdown-loader.js";
import { readFixture, mockFetchOk, mockFetch404 } from "./helpers.js";

// loadConfig をモック
vi.mock("../src/config.js", () => ({
  loadConfig: () => ({
    base_url: "http://localhost:3000",
    default_language: "ja",
    endpoints: { list_page: "/spec/data-spec" },
    cache_ttl_seconds: 300,
    external_links: {
      spec_docs: "/spec",
      help: "/help",
      migration_v1_v2: "/spec/migration-v1-v2",
    },
    v1: {
      base_url: "http://v1.example.com",
      endpoints: { list_page: "/api-reference" },
    },
  }),
  DATA_DIR: "",
}));

beforeEach(() => {
  clearCache();
  vi.restoreAllMocks();
});

describe("loadEndpointList", () => {
  it("正常に取得できる", async () => {
    const content = readFixture("mock_data_spec.md");
    vi.spyOn(globalThis, "fetch").mockImplementation(mockFetchOk(content));

    const result = await loadEndpointList();

    expect(result.content).toContain("Product Master");
    expect(result.source_url).toBe("http://localhost:3000/ja/spec/data-spec");
    expect(result.cached).toBe(false);
  });

  it("2回目はキャッシュを返す", async () => {
    const content = readFixture("mock_data_spec.md");
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(mockFetchOk(content));

    await loadEndpointList();
    const result2 = await loadEndpointList();

    expect(result2.cached).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe("loadSpecPage", () => {
  it("正常に取得できる", async () => {
    const content = readFixture("mock_status_codes.md");
    vi.spyOn(globalThis, "fetch").mockImplementation(mockFetchOk(content));

    const result = await loadSpecPage("/spec/product-master/status-codes");

    expect(result.content).toContain("Status Codes");
    expect(result.source_url).toBe(
      "http://localhost:3000/ja/spec/product-master/status-codes",
    );
    expect(result.path).toBe("/spec/product-master/status-codes");
    expect(result.cached).toBe(false);
  });

  it("404 で NotFoundError を投げる", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(mockFetch404());

    await expect(loadSpecPage("/spec/nonexistent")).rejects.toThrow(NotFoundError);
  });
});

describe("loadEndpointDetail", () => {
  it("正常に取得し endpoint_name を含む", async () => {
    const content = readFixture("mock_product_master.md");
    vi.spyOn(globalThis, "fetch").mockImplementation(mockFetchOk(content));

    const result = await loadEndpointDetail("product-master");

    expect(result.content).toContain("Product Master");
    expect(result.endpoint_name).toBe("product-master");
    expect(result.source_url).toBe("http://localhost:3000/ja/spec/product-master");
  });
});

describe("loadV1EndpointList", () => {
  it("V1 エンドポイント一覧を取得できる", async () => {
    const content = readFixture("mock_v1_api_reference.md");
    vi.spyOn(globalThis, "fetch").mockImplementation(mockFetchOk(content));

    const result = await loadV1EndpointList();

    expect(result.content).toContain("daily_quotes");
    expect(result.source_url).toBe("http://v1.example.com/api-reference");
    expect(result.cached).toBe(false);
  });

  it("2回目はキャッシュを返す", async () => {
    const content = readFixture("mock_v1_api_reference.md");
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(mockFetchOk(content));

    await loadV1EndpointList();
    const result2 = await loadV1EndpointList();

    expect(result2.cached).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe("loadV1EndpointDetail", () => {
  it("V1 エンドポイント詳細を取得できる", async () => {
    const content = readFixture("mock_v1_daily_quotes.md");
    vi.spyOn(globalThis, "fetch").mockImplementation(mockFetchOk(content));

    const result = await loadV1EndpointDetail("daily_quotes");

    expect(result.content).toContain("daily_quotes");
    expect(result.endpoint_name).toBe("daily_quotes");
    expect(result.source_url).toBe("http://v1.example.com/api-reference/daily_quotes");
  });

  it("404 で NotFoundError を投げる", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(mockFetch404());

    await expect(loadV1EndpointDetail("nonexistent")).rejects.toThrow(NotFoundError);
  });
});

describe("getExternalLinks", () => {
  it("外部リンクを正しく構築する", () => {
    const links = getExternalLinks();

    expect(links.spec_docs).toBe("http://localhost:3000/ja/spec");
    expect(links.help).toBe("http://localhost:3000/ja/help");
    expect(links.migration_v1_v2).toBe(
      "http://localhost:3000/ja/spec/migration-v1-v2",
    );
  });
});
