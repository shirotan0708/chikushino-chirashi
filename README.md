# 筑紫野・太宰府 スーパー特売チェッカー

福岡県筑紫野市・太宰府市の5店舗（明治屋ジャンボ市 太宰府店、ゆめタウン筑紫野店、ロピア筑紫野シュロアモール店、マルキョウ原田店、ダイレックス原店）のチラシをまとめて見られる静的ページです。`index.html` を GitHub Pages で公開すると、無料・アプリ不要でスマホからも見られるURLになります。

毎朝、GitHub Actionsが自動で各店のチラシ画像を取得し、Google Gemini API（無料枠）で商品名・価格・カテゴリを読み取って `data/flyers.json` を更新します。ページはカテゴリ（精肉・野菜・卵など）ごとに5店舗の価格を横並びで表示し、最安値をハイライトします。読み取れなかった店舗は元チラシへのリンクを表示します。

## GitHub Pages で公開する手順

1. https://github.com で無料アカウントを作成（すでに持っていればスキップ）
2. 右上の「+」→「New repository」で新しいリポジトリを作成
   - Repository name: `chikushino-chirashi`
   - Public を選択
   - 「Add a README file」はチェックしなくてOK（このフォルダに既にある）
3. このフォルダの中身（`index.html` など）をリポジトリにアップロード
   - VSCodeのターミナルから push する場合は下記コマンド参照
   - もしくは GitHub の「Add file → Upload files」でドラッグ&ドロップでもOK
4. リポジトリの Settings → Pages を開く
   - Source: 「Deploy from a branch」
   - Branch: `main` / `/(root)`
   - Save
5. 1分ほどで `https://(あなたのユーザー名).github.io/chikushino-chirashi/` が公開されます。このURLを妻さんに送れば、スマホのブラウザでそのまま見られます。

## VSCode のターミナルから push する場合

```bash
cd C:\Users\tyuub\work\chikushino-chirashi
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/(あなたのユーザー名)/chikushino-chirashi.git
git push -u origin main
```

`git remote add` の行は、GitHubでリポジトリを作成した直後の画面に表示されるコマンドをコピーすると確実です。push 時にブラウザでログインを求められることがあります。

## 価格の自動読み取りを有効にする手順（無料）

チラシ画像から商品名・価格を読み取るには、Google Gemini APIの無料枠を使います。以下の設定を一度行えば、あとは毎朝自動で更新されます。

1. https://ai.google.dev/ （Google AI Studio）にアクセスし、Googleアカウントでログイン
2. 「Get API key」→「Create API key」で無料のAPIキーを発行
3. このGitHubリポジトリのページで Settings → Secrets and variables → Actions を開く
4. 「New repository secret」で以下を登録
   - Name: `GEMINI_API_KEY`
   - Secret: 発行したAPIキーを貼り付け
5. リポジトリの Actions タブ → 「Update flyer data」ワークフロー → 「Run workflow」で手動実行し、`data/flyers.json` が更新されてページに価格が表示されることを確認
6. 以降は毎朝6時（JST）ごろに自動実行されます

設定前・または各サイトの構造変更等で読み取りに失敗した店舗は、これまで通り元チラシへのリンクが表示されます（ページが壊れることはありません）。

### ローカルで動作確認したいとき

```bash
GEMINI_API_KEY=発行したキー node scripts/update-flyers.mjs
```

実行後、`data/flyers.json` の中身を確認したり、`index.html` をブラウザで開いて表示を確認できます。

## チラシリンクの店舗構成を変更したいとき

このClaudeとの会話に戻って「〇〇を追加/変更して」と伝えると `scripts/update-flyers.mjs`（店舗定義）と `index.html` を書き換えます。書き換え後、以下を実行すれば公開ページに反映されます。

```bash
git add .
git commit -m "Update store list"
git push
```

## 今後やりたいこと（未着手）

- カテゴリ分類の精度向上（Geminiのプロンプト調整）
- 明治屋ジャンボ市・チラシガイド以外のソースでのバックアップ取得
