#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const __dirname = dirname(fileURLToPath(import.meta.url));
const { version } = JSON.parse(
  readFileSync(join(__dirname, "..", "package.json"), "utf-8"),
) as { version: string };

import { loadConfig, DATA_DIR } from "./config.js";
import {
  formatInternalError,
  formatNetworkErrorWithLinks,
  formatNotFoundError,
  formatNotFoundErrorWithLinks,
  formatValidationError,
} from "./errors.js";
import {
  getExternalLinks,
  loadEndpointDetail,
  loadEndpointList,
  loadSpecPage,
  loadV1EndpointDetail,
  loadV1EndpointList,
  NotFoundError,
} from "./markdown-loader.js";

// --- Patterns ---

interface UsagePattern {
  pattern_name: string;
  description: string;
  related_endpoints: string[];
  notes: string[];
  sample_code_path?: Record<string, string>;
}

function loadPatterns(): UsagePattern[] {
  const raw = readFileSync(join(DATA_DIR, "patterns.json"), "utf-8");
  return (JSON.parse(raw) as { patterns: UsagePattern[] }).patterns;
}

function loadSampleCode(sampleCodePath: string): string {
  return readFileSync(join(DATA_DIR, "templates", sampleCodePath), "utf-8");
}

// --- Server ---

const server = new McpServer({
  name: "j-quants-doc-mcp",
  version,
});

// 1. health_check
server.tool(
  "health_check",
  "ヘルスチェック用の簡易Tool。サーバが正常に動作しているかを確認する。",
  {},
  async () => ({
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          { status: "healthy", service: "j-quants-doc-mcp", version },
          null,
          2,
        ),
      },
    ],
  }),
);

// 2. search_endpoints
server.tool(
  "search_endpoints",
  "エンドポイントをキーワードとカテゴリで検索する。",
  {
    keyword: z
      .string()
      .min(1)
      .describe("検索キーワード(エンドポイント名、パス、説明から検索)"),
    category: z
      .string()
      .optional()
      .describe("オプションのカテゴリフィルタ(auth, listed, prices, fins等)"),
    api_version: z
      .enum(["v1", "v2"])
      .default("v2")
      .describe(
        "APIバージョン。V1のエンドポイントパス(/v1/...)やV1特有の名前(daily_quotes等)が含まれる場合は'v1'を指定。デフォルトは'v2'。",
      ),
  },
  async ({ keyword, category, api_version }) => {
    try {
      const links = getExternalLinks();

      if (api_version === "v1") {
        const list = await loadV1EndpointList();
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  content: list.content,
                  source_url: list.source_url,
                  cached: list.cached,
                  api_version: "v1",
                  search_keyword: keyword,
                  search_category: category ?? null,
                  instruction:
                    "【重要】これはV1 API（旧バージョン）の情報です。" +
                    "V1 APIは閉鎖が予定されているため、V2 APIへの移行を強く推奨してください。\n\n" +
                    `このMarkdownからキーワード '${keyword}' ` +
                    (category ? `およびカテゴリ '${category}' ` : "") +
                    "に一致するエンドポイントを探してください。\n\n" +
                    "回答時の注意事項:\n" +
                    "- V1の情報を提供した後、必ず「V1 APIは閉鎖予定のため、V2 APIへの移行をお願いします」と伝えてください。\n" +
                    "- V2への移行方法の詳細は migrate_v1_to_v2 ツールで取得できます。\n" +
                    `- V2 API仕様書: ${links.spec_docs ?? ""}\n` +
                    `- 移行ガイド: ${links.migration_v1_v2 ?? ""}\n`,
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      // V2
      const list = await loadEndpointList();
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                content: list.content,
                source_url: list.source_url,
                cached: list.cached,
                api_version: "v2",
                search_keyword: keyword,
                search_category: category ?? null,
                instruction:
                  `このMarkdownからキーワード '${keyword}' ` +
                  (category ? `およびカテゴリ '${category}' ` : "") +
                  "に一致するエンドポイントを探してください。\n\n" +
                  "重要な注意事項:\n" +
                  "- 取得方法欄に「CSV」と記載されているエンドポイントは、Bulk APIで全銘柄データを一括取得できます。\n" +
                  "- ユーザーが「全銘柄データ」「過去データの一括取得」などを求めている場合は、" +
                  "通常のAPIではなくBulk APIの使用を強く推奨してください。\n" +
                  "- 該当するエンドポイントが見つからない場合は、以下の公式ドキュメントも参照するようユーザーに案内してください：\n" +
                  `  - API仕様書: ${links.spec_docs ?? ""}\n` +
                  `  - ヘルプページ: ${links.help ?? ""}\n`,
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (e) {
      const result = e instanceof Error && e.message.includes("HTTP")
        ? formatNetworkErrorWithLinks(String(e))
        : formatInternalError("エンドポイント検索", e);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  },
);

// 3. describe_endpoint
server.tool(
  "describe_endpoint",
  "指定されたエンドポイントの詳細情報を取得する。",
  {
    endpoint_name: z
      .string()
      .min(1)
      .describe(
        "エンドポイント名(V2例: eq-master, eq-bars-daily / V1例: daily_quotes, listed_info等)",
      ),
    api_version: z
      .enum(["v1", "v2"])
      .default("v2")
      .describe(
        "APIバージョン。V1のエンドポイントパス(/v1/...)やV1特有の名前(daily_quotes等)が含まれる場合は'v1'を指定。デフォルトは'v2'。",
      ),
  },
  async ({ endpoint_name, api_version }) => {
    try {
      const links = getExternalLinks();

      if (api_version === "v1") {
        try {
          const detail = await loadV1EndpointDetail(endpoint_name);
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    content: detail.content,
                    source_url: detail.source_url,
                    endpoint_name: detail.endpoint_name,
                    cached: detail.cached,
                    api_version: "v1",
                    instruction:
                      "【重要】これはV1 API（旧バージョン）の情報です。" +
                      "V1 APIは閉鎖が予定されているため、V2 APIへの移行を強く推奨してください。\n\n" +
                      `このMarkdownにはV1エンドポイント '${endpoint_name}' の詳細情報が含まれています。\n` +
                      "パス、メソッド、パラメータ、レスポンス情報などを読み取ってユーザーに提供してください。\n\n" +
                      "回答時の注意事項:\n" +
                      "- V1の情報を提供した後、必ず「V1 APIは閉鎖予定のため、V2 APIへの移行をお願いします」と伝えてください。\n" +
                      "- V2への移行方法の詳細は migrate_v1_to_v2 ツールで取得できます。\n" +
                      `- V2 API仕様書: ${links.spec_docs ?? ""}\n` +
                      `- 移行ガイド: ${links.migration_v1_v2 ?? ""}\n`,
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        } catch (e) {
          if (e instanceof NotFoundError) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify(
                    formatNotFoundErrorWithLinks("V1エンドポイント", endpoint_name),
                    null,
                    2,
                  ),
                },
              ],
            };
          }
          throw e;
        }
      }

      // V2
      try {
        const detail = await loadEndpointDetail(endpoint_name);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  content: detail.content,
                  source_url: detail.source_url,
                  endpoint_name: detail.endpoint_name,
                  cached: detail.cached,
                  api_version: "v2",
                  instruction:
                    `このMarkdownにはエンドポイント '${endpoint_name}' の詳細情報が含まれています。\n` +
                    "パス、メソッド、パラメータ、レスポンス情報などを" +
                    "このMarkdownから読み取ってユーザーに提供してください。\n\n" +
                    "重要な注意事項:\n" +
                    "- 詳細な情報はsource_urlを参照するようユーザーに促してください。\n" +
                    "- このエンドポイントがBulk API対応（取得方法: CSV）の場合、" +
                    "ユーザーが全銘柄データや大量データを求めている際は、Bulk APIの使用を強く推奨してください。",
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (e) {
        if (e instanceof NotFoundError) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  formatNotFoundErrorWithLinks("エンドポイント", endpoint_name),
                  null,
                  2,
                ),
              },
            ],
          };
        }
        throw e;
      }
    } catch (e) {
      const result = e instanceof Error && e.message.includes("HTTP")
        ? formatNetworkErrorWithLinks(String(e))
        : formatInternalError("エンドポイント詳細取得", e);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  },
);

// 4. get_pattern
server.tool(
  "get_pattern",
  "実装パターン情報を取得する。パターン名を指定しない場合は全パターンの一覧を返す。",
  {
    pattern_name: z
      .string()
      .optional()
      .describe("パターン名（指定しない場合は全パターンの一覧を返す）"),
  },
  async ({ pattern_name }) => {
    try {
      const patterns = loadPatterns();

      if (!pattern_name) {
        const list = patterns.map((p) => ({
          pattern_name: p.pattern_name,
          description: p.description,
          related_endpoints: p.related_endpoints,
        }));
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  count: list.length,
                  patterns: list,
                  hint: "詳細を取得するには pattern_name を指定してください",
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      const pattern = patterns.find((p) => p.pattern_name === pattern_name);
      if (!pattern) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                formatNotFoundError(
                  "パターン",
                  pattern_name,
                  "get_pattern() を引数なしで呼び出して、利用可能なパターン一覧を確認してください。",
                ),
                null,
                2,
              ),
            },
          ],
        };
      }

      const result: Record<string, unknown> = { ...pattern };
      if (pattern.sample_code_path) {
        const sampleCodes: Record<string, string> = {};
        for (const [lang, path] of Object.entries(pattern.sample_code_path)) {
          try {
            sampleCodes[lang] = loadSampleCode(path);
          } catch {
            // サンプルコード読み込み失敗は無視
          }
        }
        if (Object.keys(sampleCodes).length > 0) {
          result.sample_code = sampleCodes;
        }
      }

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    } catch (e) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(formatInternalError("パターン取得", e), null, 2),
          },
        ],
      };
    }
  },
);

// 5. fetch_spec_page
server.tool(
  "fetch_spec_page",
  "指定されたパスのSpecificationページを取得する。エンドポイント詳細だけでなく、参照データページ（例: 休日区分、市場コード等）も取得できます。Markdown内のリンクを辿って追加情報を取得する際に使用してください。",
  {
    path: z
      .string()
      .min(1)
      .describe("Specificationページのパス(例: /spec/mkt-cal/holiday-division)"),
  },
  async ({ path }) => {
    try {
      const specPage = await loadSpecPage(path);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                content: specPage.content,
                source_url: specPage.source_url,
                path: specPage.path,
                cached: specPage.cached,
                instruction:
                  `このMarkdownにはパス '${path}' のSpecification情報が含まれています。\n` +
                  "このMarkdownから必要な情報を読み取ってユーザーに提供してください。\n\n" +
                  "重要な注意事項:\n" +
                  "- エンドポイント一覧ページの場合、取得方法欄に「CSV」と記載されているエンドポイントは" +
                  "Bulk APIで全銘柄データを一括取得できます。\n" +
                  "- ユーザーが全銘柄データや大量データを求めている場合は、Bulk APIの使用を強く推奨してください。",
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (e) {
      if (e instanceof NotFoundError) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                formatNotFoundErrorWithLinks("Specificationページ", path),
                null,
                2,
              ),
            },
          ],
        };
      }
      const result = e instanceof Error && e.message.includes("HTTP")
        ? formatNetworkErrorWithLinks(String(e))
        : formatInternalError("Specificationページ取得", e);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  },
);

// 6. migrate_v1_to_v2
server.tool(
  "migrate_v1_to_v2",
  "V1 APIからV2 APIへの移行ガイドを提供する。V1 APIを利用中のユーザーがV2 APIへ移行する際に、エンドポイントの対応関係や変更点を案内し、V2の仕様書ページへ誘導します。",
  {
    v1_endpoint: z
      .string()
      .optional()
      .describe(
        "V1 APIのエンドポイントパスまたはキーワード(例: /v1/prices/daily_quotes, 株価四本値等)。指定しない場合は移行ガイド全体を返す。",
      ),
  },
  async ({ v1_endpoint }) => {
    try {
      const config = loadConfig();
      const migrationPath = config.external_links.migration_v1_v2;
      if (!migrationPath) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                formatInternalError(
                  "移行ガイド取得",
                  new Error("external_links に migration_v1_v2 が設定されていません"),
                ),
                null,
                2,
              ),
            },
          ],
        };
      }

      const specPage = await loadSpecPage(migrationPath);
      const links = getExternalLinks();

      let instruction: string;
      if (v1_endpoint) {
        instruction =
          `ユーザーはV1 APIのエンドポイント '${v1_endpoint}' からV2 APIへの移行方法を知りたがっています。\n\n` +
          "以下のMarkdownにはV1→V2の移行ガイド（エンドポイント対応表を含む）が記載されています。\n" +
          "この情報をもとに以下の手順で回答してください：\n\n" +
          `1. Markdownのエンドポイント対応表から '${v1_endpoint}' に該当するV1エンドポイントを特定し、` +
          "対応するV2エンドポイントを案内してください。\n" +
          "2. V2エンドポイントの詳細な仕様を確認するため、describe_endpoint ツールを使って" +
          "V2エンドポイントの仕様書ページを取得し、その内容もあわせてユーザーに提供してください。\n" +
          "3. 認証方式の変更（トークン方式→APIキー方式）やレスポンス形式の変更など、" +
          "移行時に注意すべき全般的な変更点も伝えてください。\n\n" +
          `移行ガイド全文: ${links.migration_v1_v2 ?? ""}`;
      } else {
        instruction =
          "ユーザーはV1 APIからV2 APIへの移行について情報を求めています。\n\n" +
          "以下のMarkdownにはV1→V2の移行ガイドが記載されています。\n" +
          "この情報をもとに以下のポイントをユーザーに案内してください：\n\n" +
          "1. 認証方式の変更（トークン方式→APIキー方式）\n" +
          "2. プラン・データ提供範囲の変更\n" +
          "3. レートリミットの新設\n" +
          "4. エンドポイント・パラメータの変更（V1→V2の対応表）\n" +
          "5. レスポンス形式の変更\n\n" +
          `移行ガイド全文: ${links.migration_v1_v2 ?? ""}`;
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                content: specPage.content,
                source_url: specPage.source_url,
                path: specPage.path,
                cached: specPage.cached,
                instruction,
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (e) {
      if (e instanceof NotFoundError) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                formatNotFoundErrorWithLinks("移行ガイドページ", "migration-v1-v2"),
                null,
                2,
              ),
            },
          ],
        };
      }
      const result = e instanceof Error && e.message.includes("HTTP")
        ? formatNetworkErrorWithLinks(String(e))
        : formatInternalError("V1→V2移行ガイド取得", e);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  },
);

// 7. get_info
server.tool(
  "get_info",
  "API仕様書の範囲外の質問に回答するためのツール。プランの種類・料金・価格、契約方法・申込方法・支払い方法、各プランで利用可能なデータ範囲・期間、アカウント・ログインに関する問い合わせ、サポート・お問い合わせ先などの質問を受けた場合に使用してください。",
  {
    query: z
      .string()
      .optional()
      .describe("ユーザーの質問内容(例: 「Premiumプランの料金は？」「問い合わせ先は？」等)"),
  },
  async ({ query }) => {
    const links = getExternalLinks();
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              error: false,
              external_links: links,
              query: query ?? null,
              instruction:
                "【重要】プラン・契約・料金・データ提供範囲・アカウントに関する情報は、" +
                "正確性を保証するためにこのツールでは直接回答しません。\n\n" +
                "ユーザーには以下のように案内してください：\n" +
                "- プランごとの料金、データ提供範囲、契約内容については公式ページを参照してください。\n" +
                "- 具体的な契約・支払い・アカウントに関する問い合わせはヘルプページからお問い合わせください。\n\n" +
                "絶対に独自の推測や古い情報でプラン内容を回答しないでください。",
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

// --- Start ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("J-Quants Documentation MCP Server started (Node.js)");
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
