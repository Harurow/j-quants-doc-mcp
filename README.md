# @harurow/j-quants-doc-mcp

J-Quants APIのドキュメントを提供するMCPサーバー。Claude DesktopなどのMCPクライアントから、J-Quants APIのエンドポイント検索、詳細情報の取得、実装パターンの参照、FAQ回答などの機能を利用できます。

> **Note**
> 本プロジェクトは [J-Quants/j-quants-doc-mcp](https://github.com/J-Quants/j-quants-doc-mcp)（(株)JPX総研による公式リポジトリ）を fork し、Python 実装を Node.js (TypeScript) に書き換えたものです。
> 元プロジェクトは MIT License で公開されており、本リポジトリもそのライセンスを継承しています。

## 必須要件

- Node.js 18以上

## 起動方法

### npxで起動（推奨・インストール不要）

```bash
npx @harurow/j-quants-doc-mcp
```

インストールなしでそのまま実行できます。

### グローバルインストールして起動

```bash
npm install -g @harurow/j-quants-doc-mcp

j-quants-doc-mcp
```

### ローカルビルドで起動

```bash
git clone https://github.com/harurow/j-quants-doc-mcp.git
cd j-quants-doc-mcp
npm install
npm run build
node dist/index.js
```

## Claude Desktopから使用

`claude_desktop_config.json`に以下を追加:

```json
{
  "mcpServers": {
    "j-quants-doc-mcp": {
      "command": "npx",
      "args": ["-y", "@harurow/j-quants-doc-mcp"]
    }
  }
}
```

ローカルビルドを使用する場合:
```json
{
  "mcpServers": {
    "j-quants-doc-mcp": {
      "command": "node",
      "args": ["/path/to/j-quants-doc-mcp/dist/index.js"]
    }
  }
}
```

設定ファイルの場所:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

## Cursorから使用

メニューバー「Cursor」→「Preferences」→「Cursor Settings」を開き、\
左のメニュー「Tools & MCP」を選択し、「New MCP Server」をクリック。\
開かれたJSONファイル(`~/.cursor/mcp.json`)に以下を追加:

```json
{
  "mcpServers": {
    "j-quants-doc-mcp": {
      "command": "npx",
      "args": ["-y", "@harurow/j-quants-doc-mcp"]
    }
  }
}
```

以上の設定で、AIクライアントにてMCPサーバーを利用する準備が完了しました。

## 開発

```bash
# 依存関係のインストール
npm install

# ビルド
npm run build

# 開発用（tsx で直接実行）
npm run dev

# テスト
npm test
```

## トラブルシューティング

### Claude Desktopで認識されない

1. 設定ファイルのJSONが正しいか確認
2. Claude Desktopを再起動
3. `npx @harurow/j-quants-doc-mcp` をターミナルで直接実行してエラーがないか確認

### 環境変数

- `JQUANTS_BASE_URL`: APIドキュメントの取得元URLを上書きする場合に使用

## クレジット

本プロジェクトは以下のリポジトリを fork して作成されています:

- **元リポジトリ**: [J-Quants/j-quants-doc-mcp](https://github.com/J-Quants/j-quants-doc-mcp)
- **著作権者**: JPX Market Innovation & Research, Inc.
- **ライセンス**: MIT License

## 関連リンク

- [J-Quants API公式ドキュメント](https://jpx-jquants.com/spec)
- [Model Context Protocol (MCP)](https://modelcontextprotocol.io/)
- [Claude Desktop](https://claude.ai/download)
- [Cursor](https://cursor.com/ja)
