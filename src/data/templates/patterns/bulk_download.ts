import { writeFileSync } from "node:fs";

// Bulk APIを使用したデータ一括取得
// 用途: 全銘柄データを効率的に一括ダウンロード
// BulkListでファイル一覧を取得し、BulkGetで各ファイルをダウンロード

const targetEndpoint = "/markets/margin-alert"; // 日々公表信用取引残高を例とする

// ファイル一覧を取得
const listRes = await fetch(
  `https://api.jquants.com/v2/bulk/list?endpoint=${targetEndpoint}`,
  { headers: { "x-api-key": apiKey! } },
);
const listBody = await listRes.json();

let files: { Key: string }[] = listBody.data;
console.log(`利用可能なファイル: ${files.length}件`);

// ファイルのフィルタリング（必要に応じて）
// 例1: historical（月次）のみ取得したい場合
// files = files.filter((f) => f.Key.includes("historical"));
// 例2: live（日次）のみ取得したい場合
// files = files.filter((f) => f.Key.includes("live"));
// 例3: 最新の1件のみ取得したい場合
// files = [files[files.length - 1]]; // bulk-listは昇順（古い順）で返される
// 例4: 最新から遡って取得したい場合
// files = [...files].reverse();

// 各ファイルをダウンロード
for (const fileInfo of files) {
  const key = fileInfo.Key;
  // 例: markets/margin-alert/historical/2023/markets_margin-alert_202312.csv.gz
  // 例: markets/margin-alert/live/2024/markets_margin-alert_20240115.csv.gz

  // 署名付きURLを取得
  const urlRes = await fetch(
    `https://api.jquants.com/v2/bulk/get?key=${encodeURIComponent(key)}`,
    { headers: { "x-api-key": apiKey! } },
  );
  const urlBody = await urlRes.json();

  const downloadUrl: string = urlBody.url;
  // URLの有効期限は約5分なので、すぐにダウンロードする
  const csvRes = await fetch(downloadUrl);
  const csvBytes = Buffer.from(await csvRes.arrayBuffer());

  const outputPath = `./${key.split("/").pop()}`;
  writeFileSync(outputPath, csvBytes);
  console.log(`保存: ${outputPath}`);
}
