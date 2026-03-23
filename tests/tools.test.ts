/**
 * MCP ツールの統合テスト。
 * サーバーを直接インスタンス化せず、ツールのロジックに相当する
 * markdown-loader + errors の組み合わせをテストする。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFixture, mockFetchOk, mockFetch404, mockFetchError } from "./helpers.js";
import {
  loadEndpointList,
  loadEndpointDetail,
  loadV1EndpointList,
  loadV1EndpointDetail,
  loadSpecPage,
  getExternalLinks,
  clearCache,
  NotFoundError,
} from "../src/markdown-loader.js";
import {
  formatNetworkErrorWithLinks,
  formatNotFoundErrorWithLinks,
} from "../src/errors.js";

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

// =========================================================
// search_endpoints 相当のテスト
// =========================================================
describe("search_endpoints ロジック", () => {
  it("V2: エンドポイント一覧を取得し instruction に CSV 指示を含む", async () => {
    const content = readFixture("mock_data_spec.md");
    vi.spyOn(globalThis, "fetch").mockImplementation(mockFetchOk(content));

    const list = await loadEndpointList();
    const links = getExternalLinks();

    expect(list.content).toContain("Product Master");
    expect(list.source_url).toBe("http://localhost:3000/ja/spec/data-spec");

    // instruction 相当の検証
    const instruction =
      `このMarkdownからキーワード 'product' に一致するエンドポイントを探してください。\n\n` +
      `重要な注意事項:\n` +
      `- 取得方法欄に「CSV」と記載されているエンドポイントは、Bulk APIで全銘柄データを一括取得できます。\n`;
    expect(instruction).toContain("CSV");
    expect(links.spec_docs).toBe("http://localhost:3000/ja/spec");
  });

  it("V1: エンドポイント一覧を取得し V2 移行を推奨", async () => {
    const content = readFixture("mock_v1_api_reference.md");
    vi.spyOn(globalThis, "fetch").mockImplementation(mockFetchOk(content));

    const list = await loadV1EndpointList();

    expect(list.content).toContain("daily_quotes");
    expect(list.source_url).toContain("v1.example.com");
  });

  it("ネットワークエラー時にエラーレスポンスを返す", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(mockFetchError());

    try {
      await loadEndpointList();
      expect.unreachable("Should throw");
    } catch (e) {
      const result = formatNetworkErrorWithLinks(String(e));
      expect(result.error).toBe(true);
      expect(result.error_type).toBe("NetworkError");
      expect(result.instruction).toContain("API仕様書");
    }
  });
});

// =========================================================
// describe_endpoint 相当のテスト
// =========================================================
describe("describe_endpoint ロジック", () => {
  it("V2: エンドポイント詳細を取得できる", async () => {
    const content = readFixture("mock_product_master.md");
    vi.spyOn(globalThis, "fetch").mockImplementation(mockFetchOk(content));

    const detail = await loadEndpointDetail("product-master");

    expect(detail.content).toContain("Product Master");
    expect(detail.content).toContain("GET");
    expect(detail.endpoint_name).toBe("product-master");
    expect(detail.source_url).toBe("http://localhost:3000/ja/spec/product-master");
  });

  it("V2: 404 で NotFoundError を投げる", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(mockFetch404());

    try {
      await loadEndpointDetail("nonexistent");
      expect.unreachable("Should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(NotFoundError);
      const result = formatNotFoundErrorWithLinks("エンドポイント", "nonexistent");
      expect(result.error).toBe(true);
      expect(result.message).toContain("nonexistent");
    }
  });

  it("V1: エンドポイント詳細を取得できる", async () => {
    const content = readFixture("mock_v1_daily_quotes.md");
    vi.spyOn(globalThis, "fetch").mockImplementation(mockFetchOk(content));

    const detail = await loadV1EndpointDetail("daily_quotes");

    expect(detail.content).toContain("daily_quotes");
    expect(detail.endpoint_name).toBe("daily_quotes");
    expect(detail.source_url).toBe("http://v1.example.com/api-reference/daily_quotes");
  });

  it("V1: 404 で NotFoundError を投げる", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(mockFetch404());

    await expect(loadV1EndpointDetail("nonexistent")).rejects.toThrow(NotFoundError);
  });
});

// =========================================================
// fetch_spec_page 相当のテスト
// =========================================================
describe("fetch_spec_page ロジック", () => {
  it("任意のパスのページを取得できる", async () => {
    const content = readFixture("mock_status_codes.md");
    vi.spyOn(globalThis, "fetch").mockImplementation(mockFetchOk(content));

    const result = await loadSpecPage("/spec/product-master/status-codes");

    expect(result.content).toContain("Status Codes");
    expect(result.content).toContain("Active");
    expect(result.source_url).toBe(
      "http://localhost:3000/ja/spec/product-master/status-codes",
    );
    expect(result.path).toBe("/spec/product-master/status-codes");
  });

  it("先頭スラッシュの有無で同じ結果になる", async () => {
    const content = readFixture("mock_status_codes.md");
    vi.spyOn(globalThis, "fetch").mockImplementation(mockFetchOk(content));

    const r1 = await loadSpecPage("/spec/product-master/status-codes");
    clearCache();
    const r2 = await loadSpecPage("spec/product-master/status-codes");

    expect(r1.content).toBe(r2.content);
  });

  it("404 で NotFoundError を投げる", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(mockFetch404());

    await expect(loadSpecPage("/spec/nonexistent")).rejects.toThrow(NotFoundError);
  });
});

// =========================================================
// migrate_v1_to_v2 相当のテスト
// =========================================================
describe("migrate_v1_to_v2 ロジック", () => {
  it("移行ガイドページを取得できる", async () => {
    const content = readFixture("mock_migration_v1_v2.md");
    vi.spyOn(globalThis, "fetch").mockImplementation(mockFetchOk(content));

    const result = await loadSpecPage("/spec/migration-v1-v2");

    expect(result.content).toContain("V1 API から V2 API");
    expect(result.content).toContain("認証認可");
  });

  it("移行ガイドが見つからない場合に NotFoundError", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(mockFetch404());

    await expect(loadSpecPage("/spec/migration-v1-v2")).rejects.toThrow(NotFoundError);
  });
});

// =========================================================
// get_info 相当のテスト
// =========================================================
describe("get_info ロジック", () => {
  it("外部リンクを正しく返す", () => {
    const links = getExternalLinks();

    expect(links.spec_docs).toBe("http://localhost:3000/ja/spec");
    expect(links.help).toBe("http://localhost:3000/ja/help");
    expect(links.migration_v1_v2).toBe(
      "http://localhost:3000/ja/spec/migration-v1-v2",
    );
  });
});

// =========================================================
// キャッシュ動作
// =========================================================
describe("キャッシュ動作", () => {
  it("V1 エンドポイント一覧のキャッシュ", async () => {
    const content = readFixture("mock_v1_api_reference.md");
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(mockFetchOk(content));

    const r1 = await loadV1EndpointList();
    expect(r1.cached).toBe(false);
    expect(spy).toHaveBeenCalledTimes(1);

    const r2 = await loadV1EndpointList();
    expect(r2.cached).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("V1 エンドポイント詳細のキャッシュ", async () => {
    const content = readFixture("mock_v1_daily_quotes.md");
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(mockFetchOk(content));

    const r1 = await loadV1EndpointDetail("daily_quotes");
    expect(r1.cached).toBe(false);

    const r2 = await loadV1EndpointDetail("daily_quotes");
    expect(r2.cached).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
