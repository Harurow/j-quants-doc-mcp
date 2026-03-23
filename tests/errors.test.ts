import { describe, it, expect, vi } from "vitest";
import {
  formatValidationError,
  formatNotFoundError,
  formatInternalError,
  formatNetworkErrorWithLinks,
  formatNotFoundErrorWithLinks,
} from "../src/errors.js";

// getExternalLinks をモック
vi.mock("../src/markdown-loader.js", () => ({
  getExternalLinks: () => ({
    spec_docs: "http://localhost:3000/ja/spec",
    help: "http://localhost:3000/ja/help",
  }),
}));

describe("formatValidationError", () => {
  it("バリデーションエラーを正しくフォーマットする", () => {
    const result = formatValidationError("keyword", "キーワードは必須です");

    expect(result.error).toBe(true);
    expect(result.error_type).toBe("ValidationError");
    expect(result.message).toContain("keyword");
    expect(result.message).toContain("キーワードは必須です");
    expect(result.details.field).toBe("keyword");
    expect(result.details.validation_error).toBe("キーワードは必須です");
  });
});

describe("formatNotFoundError", () => {
  it("基本的な未検出エラーをフォーマットする", () => {
    const result = formatNotFoundError("エンドポイント", "invalid_endpoint");

    expect(result.error).toBe(true);
    expect(result.error_type).toBe("NotFoundError");
    expect(result.message).toContain("invalid_endpoint");
    expect(result.message).toContain("見つかりませんでした");
  });

  it("提案メッセージ付きでフォーマットする", () => {
    const result = formatNotFoundError(
      "エンドポイント",
      "invalid_endpoint",
      "search_endpoints ツールで検索できます。",
    );

    expect(result.message).toContain("search_endpoints");
    expect(result.details.suggestion).toBe("search_endpoints ツールで検索できます。");
  });
});

describe("formatInternalError", () => {
  it("内部エラーをフォーマットする", () => {
    const result = formatInternalError("エンドポイント検索", new Error("予期しないエラー"));

    expect(result.error).toBe(true);
    expect(result.error_type).toBe("InternalError");
    expect(result.message).toContain("内部エラー");
    expect(result.message).toContain("エンドポイント検索");
    expect(result.details.original_error).toBe("予期しないエラー");
  });
});

describe("formatNetworkErrorWithLinks", () => {
  it("外部リンク付きネットワークエラーを返す", () => {
    const result = formatNetworkErrorWithLinks("Connection failed");

    expect(result.error).toBe(true);
    expect(result.error_type).toBe("NetworkError");
    expect(result.message).toBe("Connection failed");
    expect(result.external_links.spec_docs).toContain("localhost:3000");
    expect(result.instruction).toContain("API仕様書");
  });
});

describe("formatNotFoundErrorWithLinks", () => {
  it("外部リンク付き未検出エラーを返す", () => {
    const result = formatNotFoundErrorWithLinks("エンドポイント", "nonexistent");

    expect(result.error).toBe(true);
    expect(result.error_type).toBe("NotFoundError");
    expect(result.message).toContain("nonexistent");
    expect(result.external_links.spec_docs).toContain("localhost:3000");
    expect(result.instruction).toContain("公式ドキュメント");
  });
});
