# CLAUDE.md

J-Quants API ドキュメント MCP サーバー（TypeScript 実装）の開発ガイド。

## プロジェクト概要

[J-Quants/j-quants-doc-mcp](https://github.com/J-Quants/j-quants-doc-mcp)（Python 実装）を fork し、Node.js/TypeScript で書き直した MCP サーバー。
Claude Desktop・Cursor 等の AI クライアントから J-Quants API ドキュメントへアクセスする機能を提供する。

## 技術スタック

- **ランタイム**: Node.js 18+
- **言語**: TypeScript 5.7+（strict モード）
- **MCP SDK**: `@modelcontextprotocol/sdk` ^1.12.1
- **バリデーション**: `zod` ^3.24.0
- **テスト**: `vitest` ^4.1.0
- **開発用実行**: `tsx` ^4.19.0
- **モジュール形式**: ESM (`"type": "module"`, `"module": "Node16"`)

## コマンド

```bash
npm install          # 依存関係インストール
npm run build        # tsc + src/data を dist/ にコピー
npm run dev          # tsx で直接実行（開発用）
npm test             # vitest run（全テスト実行）
npm start            # node dist/index.js
```

## ディレクトリ構成

```
src/
├── index.ts              # MCP サーバー定義・7 つのツール実装
├── config.ts             # spec_config.json のシングルトン読み込み
├── errors.ts             # エラーレスポンスフォーマッタ（5 関数）
├── markdown-loader.ts    # Markdown 取得・メモリ内キャッシュ
└── data/
    ├── spec_config.json  # ベース URL・キャッシュ TTL・外部リンク定義
    ├── patterns.json     # 実装パターンメタデータ
    ├── reference_data.json
    └── templates/patterns/  # Python サンプルコード

tests/
├── helpers.ts            # テストユーティリティ（mockFetch*, readFixture）
├── errors.test.ts        # エラーフォーマッタ単体テスト
├── markdown-loader.test.ts  # Markdown 取得・キャッシュテスト
├── tools.test.ts         # ツール統合テスト
└── fixtures/             # テスト用 Markdown フィクスチャ
```

## アーキテクチャと設計方針

### モジュール責任分離

| モジュール | 責任 |
|-----------|------|
| `index.ts` | MCP ツール定義、ビジネスロジック、レスポンス組み立て |
| `config.ts` | 設定読み込み（シングルトン）、環境変数上書き対応 |
| `errors.ts` | 統一エラーレスポンス生成（`format*Error` 関数群） |
| `markdown-loader.ts` | HTTP fetch、メモリ内キャッシュ（TTL ベース）、外部リンク構築 |

### MCP ツール一覧（7 つ）

| ツール | 概要 |
|--------|------|
| `health_check` | サーバー健全性確認 |
| `search_endpoints` | V1/V2 エンドポイント検索 |
| `describe_endpoint` | エンドポイント詳細取得 |
| `get_pattern` | 実装パターン・サンプルコード取得 |
| `fetch_spec_page` | 任意パスの Markdown 取得 |
| `migrate_v1_to_v2` | V1→V2 移行ガイド |
| `get_info` | 契約・料金情報（外部リンク参照） |

### 主要な設計パターン

- **入力検証**: 全ツールで Zod スキーマを使用（`z.enum`, `z.string().min(1)`, `z.string().optional()` など）
- **エラーハンドリング**: 3 種類に分類（`NotFoundError`, `NetworkError`, `InternalError`）→ `errors.ts` の統一フォーマッタで JSON レスポンス化
- **キャッシュ**: メモリ内 `Map<string, CacheEntry>` + TTL（デフォルト 300 秒）。テストでは `clearCache()` で隔離
- **AI 向け instruction**: レスポンス JSON に `instruction` フィールドを埋め込み、AI の回答行動を制御
- **V1 廃止警告**: V1 API アクセス時は常に V2 移行推奨メッセージを付与
- **Bulk API 推奨**: データ取得系ツールで一括取得（CSV）の推奨メッセージを含める

### エラーレスポンス統一フォーマット

```json
{
  "error": true,
  "error_type": "NotFoundError|ValidationError|NetworkError|InternalError",
  "message": "日本語メッセージ",
  "details": { ... },
  "instruction": "AI 向けの指示",
  "external_links": { ... }
}
```

### 設定管理

- `src/data/spec_config.json` で API ベース URL、キャッシュ TTL、外部リンクを定義
- 環境変数 `JQUANTS_BASE_URL` でベース URL を上書き可能
- `loadConfig()` はシングルトン（初回のみファイル読み込み）

## コーディング規約

### 命名

- **ファイル名**: kebab-case（`markdown-loader.ts`）
- **データファイル**: snake_case（`spec_config.json`）
- **インターフェース・クラス**: PascalCase（`SpecConfig`, `NotFoundError`）
- **関数**: camelCase、接頭辞で役割を示す（`load*`, `format*Error`, `get*`, `is*`）
- **キャッシュキー**: snake_case（`list_${lang}`, `spec_${lang}_${normalized}`）

### インポート

- ESM 形式（`import ... from "..."`)
- ローカルモジュール参照は `.js` 拡張子付き（TypeScript の ESM 規約）

### エラー処理

- 各ツール内で `try-catch` → `errors.ts` のフォーマッタで統一レスポンス化
- `NotFoundError` は `markdown-loader.ts` で定義されたカスタムエラークラス
- サンプルコード読み込み失敗は黙示的に無視（パターン情報は返す）
- HTTP fetch は `AbortSignal.timeout(10_000)` で 10 秒タイムアウト

### レスポンス設計

- 全ツールの戻り値は `{ content: [{ type: "text", text: JSON.stringify(...) }] }` 形式
- `instruction` フィールドで AI に対する指示を埋め込む（ユーザーには直接見えない）
- エラー時も `external_links` で代替手段を提示

## テスト

### テスト方針

- **ユニットテスト**: `errors.ts`、`markdown-loader.ts` の各関数を個別にテスト
- **統合テスト**: `tools.test.ts` で MCP ツールの入出力をエンドツーエンドでテスト
- **外部依存の排除**: `fetch` を `vi.spyOn(globalThis, "fetch")` でモック化。実際の HTTP リクエストは行わない
- **テスト間の隔離**: `beforeEach` で `clearCache()` と `vi.restoreAllMocks()` を実行

### モック戦略

```typescript
// config モック（テスト用設定を注入）
vi.mock("../src/config.js", () => ({
  loadConfig: () => ({ /* テスト用設定 */ }),
  DATA_DIR: ""
}));

// fetch モック（helpers.ts のユーティリティ）
vi.spyOn(globalThis, "fetch").mockImplementation(mockFetchOk(content));
vi.spyOn(globalThis, "fetch").mockImplementation(mockFetch404());
vi.spyOn(globalThis, "fetch").mockImplementation(mockFetchError());

// フィクスチャ読み込み
readFixture("mock_data_spec.md");  // tests/fixtures/ から Markdown 取得
```

### テストフィクスチャ（tests/fixtures/）

| ファイル | 用途 |
|---------|------|
| `mock_data_spec.md` | V2 エンドポイント一覧 |
| `mock_product_master.md` | エンドポイント詳細 |
| `mock_status_codes.md` | ステータスコード情報 |
| `mock_v1_api_reference.md` | V1 エンドポイント一覧 |
| `mock_v1_daily_quotes.md` | V1 エンドポイント詳細 |
| `mock_migration_v1_v2.md` | V1→V2 移行ガイド |

### テストで確認している主要観点

- エラーフォーマッタが正しい JSON 構造を返すこと
- キャッシュが機能していること（2 回目の呼び出しで fetch が呼ばれないこと）
- 404 レスポンスで `NotFoundError` がスローされること
- V1 API アクセス時に移行警告が含まれること
- パス正規化（先頭スラッシュの有無で同じ結果になること）
- ネットワークエラー時のエラーレスポンス形式

## レビュー観点

### 機能面

- [ ] Zod スキーマで入力パラメータが適切に検証されているか
- [ ] エラーレスポンスが統一フォーマット（`errors.ts` のフォーマッタ）を使用しているか
- [ ] V1 API アクセス時に V2 移行推奨メッセージが含まれているか
- [ ] Bulk API 推奨メッセージが適切に含まれているか
- [ ] `instruction` フィールドで AI に対する指示が適切に記述されているか
- [ ] キャッシュキーが一意かつ正しく正規化されているか

### コード品質

- [ ] TypeScript strict モードでコンパイルエラーがないか
- [ ] エラーハンドリングが `try-catch` + フォーマッタで統一されているか
- [ ] 関数・変数の命名規約（camelCase / PascalCase）に従っているか
- [ ] ESM インポートで `.js` 拡張子が付いているか
- [ ] 不要な依存が追加されていないか

### テスト

- [ ] 新機能・変更に対応するテストが追加されているか
- [ ] `fetch` モックが適切に設定されているか（実際の HTTP リクエストが発生しないこと）
- [ ] `beforeEach` で `clearCache()` と `vi.restoreAllMocks()` が呼ばれているか
- [ ] エラーケース（404、ネットワークエラー）のテストがあるか
- [ ] テストフィクスチャが `tests/fixtures/` に配置されているか

### セキュリティ

- [ ] ユーザー入力が直接 URL に展開される場合、パストラバーサルが防止されているか
- [ ] HTTP リクエストにタイムアウト（`AbortSignal.timeout`）が設定されているか
- [ ] `User-Agent` ヘッダーが適切に設定されているか
- [ ] 機密情報（API キー等）がレスポンスに含まれていないか

## Git ブランチ戦略

- `main`: リリース用
- `feature/*`: 加筆修正用（main に対して PR を作成）
- コミットは原則 1 PR につき 1 コミットにまとめる

## 環境変数

| 変数名 | 用途 | デフォルト |
|--------|------|-----------|
| `JQUANTS_BASE_URL` | API ドキュメント取得元 URL の上書き | `https://jpx-jquants.com` |

## 配布

- NPM パッケージ: `@harurow/j-quants-doc-mcp`
- 実行: `npx @harurow/j-quants-doc-mcp`（インストール不要）
- ビルド成果物: `dist/` ディレクトリ（`tsc` 出力 + `src/data/` コピー）
