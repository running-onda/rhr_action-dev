# Phase 1: フロント API 部品追加（現状）

追加したファイル:

- `js/api.js` … GAS Webアプリへ POST する共通クライアント
- `js/room.js` … `?room=...&role=...` の解析、URL生成ヘルパ
- `js/assessment-store.js` … `createRoom/getRooms/getAssessment/saveAssessment` の薄いラッパ

このフェーズでは **既存の `index.html` はまだ GAS 保存に切り替えていません**。
次フェーズで `viewer.html`（または `index.html`）にこれらを接続します。

