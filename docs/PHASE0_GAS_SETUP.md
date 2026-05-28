# Phase 0: GAS + env セットアップ手順

## 0. 事前準備（スプレッドシート作成）

指定の Drive フォルダ配下に、Google スプレッドシートを 1つ作成します。

- ブック名例: `RHR_行動指針_評定データ`

この段階ではシート（タブ）は空でOKです（GAS 初回実行で自動作成されます）。

## 1. Apps Script 作成

1. 作成したスプレッドシートを開く
2. **拡張機能 → Apps Script** を開く（コンテナバインド推奨）
3. `gas/Code.gs` の内容を貼り付け
4. `gas/appsscript.json` の内容を **プロジェクトのマニフェスト**に反映（任意）

## 2. Script Properties 設定（必須）

Apps Script エディタで **プロジェクトの設定 → スクリプト プロパティ** に以下を追加します。

- `API_TOKEN`: 任意の長めのトークン（例: 32文字以上）
- `SPREADSHEET_ID`: 作成したスプレッドシートのID

スプレッドシートIDはURLの `/d/<ここ>/edit` の `<ここ>` です。

## 3. Webアプリとしてデプロイ（必須）

1. **デプロイ → 新しいデプロイ**
2. 種類: **ウェブアプリ**
3. 実行ユーザー: **自分**
4. アクセスできるユーザー: **全員**（※社内公開でも、フロントがブラウザから直接呼ぶため WebApp 自体は「全員」設定が必要）
5. デプロイして、URL（`/exec`）を控える

## 4. フロントの env.js 設定（必須）

`env.js` の以下を埋めます。

- `apiUrl`: WebアプリURL（`.../exec`）
- `apiToken`: `API_TOKEN` と同じ値

## 5. 疎通確認（手動）

WebアプリURLに対して POST で以下を送ると rooms が1件作成されます。

```json
{
  "token": "<API_TOKEN>",
  "action": "createRoom",
  "employeeName": "テスト太郎",
  "gradeIndex": 2,
  "gradeName": "スタメン",
  "managerName": "上司花子"
}
```

スプレッドシートの `rooms` タブが生成され、行が追加されていればOKです。

