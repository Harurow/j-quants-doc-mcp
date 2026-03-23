// リトライ処理付きのリクエスト関数
const MAX_RETRIES = 3;
const BASE_WAIT_TIME = 1000; // ミリ秒

async function requestWithRetry(path: string, params: Record<string, string>) {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const query = new URLSearchParams(params);
      const res = await fetch(
        `https://api.jquants.com/v2${path}?${query}`,
        { headers: { "x-api-key": apiKey! } },
      );

      if (res.ok) {
        return await res.json();
      } else if (res.status === 429) {
        // レート制限エラー
        const retryAfter = res.headers.get("Retry-After");
        const waitTime = retryAfter
          ? parseFloat(retryAfter) * 1000
          : BASE_WAIT_TIME * 2 ** attempt;
        console.log(`レート制限。${waitTime}ms 待機します`);
        await new Promise((r) => setTimeout(r, waitTime));
      } else {
        throw new Error(`エラー: ${res.status}`);
      }
    } catch (e) {
      if (attempt === MAX_RETRIES - 1) throw e;
      await new Promise((r) => setTimeout(r, BASE_WAIT_TIME * 2 ** attempt));
    }
  }
}

// 複数リクエストの場合は間隔を空ける
const codes = ["7203", "6758", "9984"];
for (const code of codes) {
  const data = await requestWithRetry("/equities/bars/daily", { code });
  processData(data);
  await new Promise((r) => setTimeout(r, 500)); // 次のリクエストまで待機
}
