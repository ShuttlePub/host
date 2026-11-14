# note-search-api-contract Implementation Packet

## Goal

ShuttlePub の /api/v1 に、投稿者を任意指定できる投稿検索(D04)の API 契約を確定させる。マージ済み S8(`server/src/api_v1/personal_domain.rs` の `searchPersonalNotes`)を拡張し、入力(`author` 任意・`q` 任意・`limit`・`cursor`)、新設の結果型(`NoteSearchItem`: post / reply / quote、CW 付きは CW のみ、純粋リポストは型で表現不能)、カーソル、ページ途中の変化の扱い、エラー(400 / 404 / 新設 `search_timeout` 503)を、型・生成 schema・fixture・明示的な 501 route として固定する。実検索・DB 部分一致・検索エンジン連携は実装しない。

## Why

frontends が D04 の検索 UI(`from:@user` を `author` へ変換する BFF/UI)を契約に準拠して作るため。ユーザー決定により、標準構成(検索エンジンなし)でも投稿者なしのキーワード検索を提供する(d04-q05 の「標準構成は投稿者必須」を置き換え)。S8 の現行 `searchPersonalNotes` は `q` 必須で結果が `FeedItem`(純粋リポストを含みうる)のため、D04 の要件を表現できない。

## Scope

- `GET /api/v1/profiles/{profile_nanoid}/notes/search`(operationId `searchPersonalNotes` のまま)に `author`(canonical actor ID URL、任意、1 人)・`q`(任意、1〜256 文字のリテラル部分一致)・`limit`(1〜50)・`cursor`。`author` と `q` の両方が無い、`q` が空、範囲外は 400 `invalid_request`
- 検索の意味: 本文と CW が対象、引用先・返信先の本文は対象外、% _ \ はリテラル、新しい順(`created_at` 降順、同時刻は `note_id` 降順)。大文字小文字・複数語 AND は未決と明記
- 新設結果型: `NoteSearchResponse.items` は `NoteSearchItem`(`post` / `reply` / `quote`)。各 item は `note_id`・`author`・`created_at`・表示本体(`text` か `content_warning` の閉じた sum 型)
- 閲覧可能な投稿のみ。S8 の mute/block 抑制を検索にも適用(痕跡なし)。対象 domain の author は 200 空結果
- 404(未取得 author、details.field=author)、新エラー `search_timeout`(503、部分結果なし)
- カーソル: `(created_at, note_id)` の keyset と検索条件(Profile・author・q)への結び付け、不一致・破損は 400(details.field=cursor)
- ページ途中の編集・削除・閲覧権変更・mute/block 追加の扱い(スナップショットなし、各ページは最新状態で評価、重複なし)
- fixture(`search.json`)と test-only 参照投影、`surfaces.json` の search 検証の差し替え、型・schema・501 route テスト、docs/README 更新、`openapi/shuttlepub.json` の再生成

## Out of scope

- 実検索・DB 部分一致(pg_trgm 等)・検索エンジン連携・負荷対策・件数/時間の実計測・実カーソル発行
- 複数投稿者(OR)検索、日付・メディア種別などの条件、個人履歴検索(別機能)、アカウント検索
- 大文字小文字の同一視・複数語 AND の確定(未決のまま)
- `from:@user` の解析(UI/BFF の責務)、外部 actor の取得処理
- timeline / notifications / FeedItem の変更、既存 dev API の変更、frontends の UI 実装

## Verification

- 型・serialization テスト(`NoteSearchItem` の往復、repost・CW+content 拒否、`SearchTimeout` コード)
- 生成 schema テスト(入力パラメーターの範囲、新結果型の closure、`search_timeout` 503 の応答、dev API を含まない)と再生成差分なし
- `search.json` fixture を schema と test-only 参照投影に照合(種別・CW・author/q 組合せ・400/404/503・suppress・ページ境界・カーソル不一致・ページ途中の変化)
- 全契約 route が 501 を返す route テスト、既存 S0/S3/S8 テストの回帰なし
- Rust CI(fmt / clippy -D warnings / test / build / git diff --check)と openapi 再生成差分 CI がグリーン

## Knowledge Maintenance (G461)

- Intent placement: social-experience.md I04 節と candidates.md D04 節に本 unit の依存・到達範囲・d04-q05 の置き換えを追記(新規 intent ノード不要)
- ADR candidate: none(S0 の生成 schema 正本 ADR に従う)
- Diagram candidate: none
- Docs update: D04 に「API 契約のみ」と未決事項・ページ途中の変化の扱いを記録
- Closeout learning: 全体検索の負荷上限の表現、カーソル結び付け、純粋リポストの型排除を記録(`write_back_required: true`)
- Guide reachability (G645): `guide workflow task implementation-loop` / implementation / ShuttlePub/ShuttlePub (`server/`, `openapi/shuttlepub.json`)
