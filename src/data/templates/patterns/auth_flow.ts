// 1. APIキーの取得
const apiKey = process.env.JQUANTS_API_KEY;

// 2. APIリクエスト時にAPIキーを使用
const res = await fetch("https://api.jquants.com/v2/equities/master", {
  headers: { "x-api-key": apiKey! },
});
const data = await res.json();
