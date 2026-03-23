// 全データを取得するループ処理
const allData: unknown[] = [];
let paginationKey: string | undefined;

while (true) {
  const params = new URLSearchParams({ date: "2025-10-01" });
  if (paginationKey) {
    params.set("pagination_key", paginationKey);
  }

  const res = await fetch(
    `https://api.jquants.com/v2/equities/bars/daily?${params}`,
    { headers: { "x-api-key": apiKey! } },
  );
  const body = await res.json();

  allData.push(...body.data);

  // 次のページがあるかチェック
  if (body.pagination_key) {
    paginationKey = body.pagination_key;
    await new Promise((r) => setTimeout(r, 500)); // レート制限対策
  } else {
    break; // 最終ページに到達
  }
}

console.log(`取得件数: ${allData.length}`);
