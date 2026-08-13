// 毎日実行: 各店のチラシ画像を取得し、Gemini APIで商品名・価格・カテゴリを抽出して
// data/flyers.json に書き出す。Node.js 18+ 標準の fetch のみ使用（依存パッケージなし）。

import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = `${__dirname}/../data/flyers.json`;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-flash-latest";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) chikushino-chirashi-bot";

const CATEGORIES = [
  "精肉",
  "鮮魚",
  "野菜・果物",
  "卵・乳製品",
  "惣菜",
  "飲料・お酒",
  "日用品",
  "その他",
];

const STORES = [
  {
    id: "meijiya-dazaifu",
    name: "明治屋ジャンボ市 太宰府店",
    sourceUrl:
      "https://chirashi-guide.com/%E7%A6%8F%E5%B2%A1%E7%9C%8C/%E5%A4%AA%E5%AE%B0%E5%BA%9C%E5%B8%82/178882/",
    extractImageUrls: (html) => {
      const m = html.match(/data-original="(https:\/\/chirashi-guide\.com\/chirashi-file\/[^"]+\.jpg)"/);
      return m ? [m[1]] : [];
    },
  },
  {
    id: "yumetown-chikushino",
    name: "ゆめタウン筑紫野店",
    sourceUrl: "https://tokubai.co.jp/%E3%82%86%E3%82%81%E3%82%BF%E3%82%A6%E3%83%B3/84624",
    extractImageUrls: (html) => extractTokubaiLeafletUrls(html),
  },
  {
    id: "ropia-chikushino",
    name: "ロピア筑紫野シュロアモール店",
    sourceUrl: "https://tokubai.co.jp/%E3%83%AD%E3%83%94%E3%82%A2/291677",
    extractImageUrls: (html) => extractTokubaiLeafletUrls(html),
  },
  {
    id: "marukyo-harada",
    name: "マルキョウ原田店",
    sourceUrl: "https://www.shufoo.net/pntweb/shopDetail/291159/",
    extractImageUrls: (html) => extractShufooTileUrls(html),
  },
  {
    id: "direx-hara",
    name: "ダイレックス原店",
    sourceUrl: "https://tokubai.co.jp/%E3%83%80%E3%82%A4%E3%83%AC%E3%83%83%E3%82%AF%E3%82%B9/33142",
    extractImageUrls: (html) => extractTokubaiLeafletUrls(html),
  },
];

// トクバイの店舗ページは新しい順にチラシ画像が並ぶ。先頭2枚（今週分の1〜2ページ目）を使う。
function extractTokubaiLeafletUrls(html) {
  const matches = [
    ...html.matchAll(
      /data-src="(https:\/\/image\.tokubai\.co\.jp\/images\/bargain_(?:office_)?leaflets\/[^"]+\.jpg[^"]*)"/g
    ),
  ];
  return matches.slice(0, 2).map((m) => m[1]);
}

// Shufoo!のチラシは "thumb_m.jpg" だと138x85程度の極小サムネイルしか無くAIが読めない。
// ビューアーが内部で使うタイル画像（index/contents.xml で定義されるページ分割画像）を
// 等倍の2倍スケールで組み立てて、読める解像度の画像セットを作る。
async function extractShufooTileUrls(html) {
  const m = html.match(/\/\/ipqcache2\.shufoo\.net\/c\/([^"]+?)\/index\/img\/thumb\/thumb_m\.jpg/);
  if (!m) return [];

  const basePath = `https://ipqcache2.shufoo.net/c/${m[1]}/index/`;
  const thumbUrl = `https:${m[0]}`;

  let xml;
  try {
    xml = await fetchText(`${basePath}contents.xml`);
  } catch {
    return [thumbUrl];
  }

  const totalPages = Number(xml.match(/<totalPages>(\d+)<\/totalPages>/)?.[1] || 1);
  const bookW = Number(xml.match(/<bookW>(\d+)<\/bookW>/)?.[1] || 0);
  const bookH = Number(xml.match(/<bookH>(\d+)<\/bookH>/)?.[1] || 0);
  const sliceW = Number(xml.match(/<sliceW>(\d+)<\/sliceW>/)?.[1] || 512);
  const sliceH = Number(xml.match(/<sliceH>(\d+)<\/sliceH>/)?.[1] || 512);
  if (!bookW || !bookH) return [thumbUrl];

  const scale = 2; // サムネイルより十分読める解像度（縦横2倍）
  const zlevel = 100 * scale;
  const column = Math.ceil((bookW * scale) / sliceW);
  const row = Math.ceil((bookH * scale) / sliceH);

  const urls = [];
  for (let page = 0; page < Math.min(totalPages, 4); page++) {
    for (let seq = 0; seq < column * row; seq++) {
      urls.push(`${basePath}img/${page}_${zlevel}_${seq}.jpg`);
    }
  }
  return urls.length > 0 ? urls : [thumbUrl];
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

async function fetchImageAsBase64(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") || "image/jpeg";
  return { base64: buf.toString("base64"), mimeType: contentType.split(";")[0] };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 503(混雑)・429(レート制限)は一時的なことが多いので、待って数回リトライする。
async function callGeminiWithRetry(parts, maxAttempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      }
    );

    if (res.ok) return res.json();

    const bodyText = await res.text();
    lastError = new Error(`Gemini API error: HTTP ${res.status} ${bodyText}`);

    const retryable = res.status === 503 || res.status === 429 || res.status >= 500;
    if (!retryable || attempt === maxAttempts) throw lastError;

    const waitMs = 2000 * 2 ** (attempt - 1); // 2s, 4s, 8s...
    console.error(`Gemini API ${res.status}、${waitMs / 1000}秒後にリトライ (${attempt}/${maxAttempts})`);
    await sleep(waitMs);
  }
  throw lastError;
}

async function extractItemsWithGemini(images) {
  const prompt = `あなたはスーパーの特売チラシ画像から商品情報を読み取るアシスタントです。
添付されたチラシ画像に写っている「目玉商品・特売商品」を可能な限り抽出してください。
各商品について以下のJSON配列だけを出力してください（説明文やマークダウンは不要）。

[
  { "name": "商品名（簡潔に）", "price": 198, "unit": "1パック/100gあたり等、価格の単位。不明なら空文字", "category": "下記カテゴリの中から最も近いもの一つ" }
]

カテゴリは必ず次のいずれかにしてください: ${CATEGORIES.join(", ")}

価格は税抜・税込どちらでもチラシに書かれている数値をそのまま整数（円）で入れてください。
読み取れない・チラシが特売情報を含まない場合は空配列 [] を返してください。`;

  const parts = [
    { text: prompt },
    ...images.map((img) => ({ inlineData: { mimeType: img.mimeType, data: img.base64 } })),
  ];

  const data = await callGeminiWithRetry(parts);
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini response has no text");

  const items = JSON.parse(text);
  if (!Array.isArray(items)) throw new Error("Gemini response is not an array");

  return items
    .filter((it) => it && typeof it.name === "string" && Number.isFinite(Number(it.price)))
    .map((it) => ({
      name: String(it.name).slice(0, 60),
      price: Math.round(Number(it.price)),
      unit: typeof it.unit === "string" ? it.unit.slice(0, 20) : "",
      category: CATEGORIES.includes(it.category) ? it.category : "その他",
    }));
}

async function processStore(store) {
  const result = {
    id: store.id,
    name: store.name,
    sourceUrl: store.sourceUrl,
    status: "ok",
    items: [],
  };

  let html;
  try {
    html = await fetchText(store.sourceUrl);
  } catch (err) {
    console.error(`[${store.id}] ページ取得失敗:`, err.message);
    result.status = "fetch_failed";
    return result;
  }

  const imageUrls = await store.extractImageUrls(html);
  if (imageUrls.length === 0) {
    console.error(`[${store.id}] チラシ画像URLが見つかりませんでした`);
    result.status = "no_image_found";
    return result;
  }
  result.flyerImageUrls = imageUrls;

  if (!GEMINI_API_KEY) {
    result.status = "no_api_key";
    return result;
  }

  let images;
  try {
    images = await Promise.all(imageUrls.map(fetchImageAsBase64));
  } catch (err) {
    console.error(`[${store.id}] 画像ダウンロード失敗:`, err.message);
    result.status = "fetch_failed";
    return result;
  }

  try {
    result.items = await extractItemsWithGemini(images);
  } catch (err) {
    console.error(`[${store.id}] Gemini抽出失敗:`, err.message);
    result.status = "extract_failed";
    return result;
  }

  if (result.items.length === 0) {
    result.status = "no_items";
  }

  return result;
}

async function main() {
  const stores = [];
  for (const store of STORES) {
    // レート制限を避けるため直列実行
    stores.push(await processStore(store));
  }

  const output = {
    updatedAt: new Date().toISOString(),
    categories: CATEGORIES,
    stores,
  };

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2), "utf-8");
  console.log(`書き出し完了: ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
