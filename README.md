# 筑紫野・太宰府 スーパー特売チェッカー

福岡県筑紫野市・太宰府市の5店舗（明治屋ジャンボ市 太宰府店、ゆめタウン筑紫野店、ロピア筑紫野シュロアモール店、マルキョウ原田店、ダイレックス原店）のチラシリンクをまとめた静的ページです。`index.html` を GitHub Pages で公開すると、無料・アプリ不要でスマホからも見られるURLになります。

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

## 内容を更新したいとき

このClaudeとの会話に戻って「チラシ情報を更新して」と伝えると `index.html` を最新の内容に書き換えます。書き換え後、以下を実行すれば公開ページに反映されます。

```bash
git add .
git commit -m "Update flyer links"
git push
```

## 今後やりたいこと（未着手）

- 各店の実際の目玉商品・価格を自動抽出する（現状はチラシが画像のため、Claude in Chrome 拡張機能の接続が必要）
- 毎朝自動でチラシを再取得し、このページを更新するスケジュールタスクの設定
