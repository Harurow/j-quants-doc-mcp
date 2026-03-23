// 特定企業の財務情報を取得
const res = await fetch(
  "https://api.jquants.com/v2/fins/summary?code=86970", // 日揮ホールディングス
  { headers: { "x-api-key": apiKey! } },
);
const body = await res.json();

// 時系列分析のため複数期のデータを取得
const financialData = body.data.map(
  (statement: Record<string, unknown>) => ({
    date: statement.PubDate,
    sales: statement.Sales as number,
    operatingProfit: statement.OP as number,
    netProfit: statement.NP as number,
    eps: statement.EPS as number,
  }),
);

// 成長率の計算
for (let i = 1; i < financialData.length; i++) {
  const prev = financialData[i - 1];
  const curr = financialData[i];
  const salesGrowth = ((curr.sales - prev.sales) / prev.sales) * 100;
  console.log(`${curr.date}: 売上成長率 ${salesGrowth.toFixed(2)}%`);
}
