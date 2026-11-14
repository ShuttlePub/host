## Goal

ShuttlePub の /api/v1 に、投稿者を任意指定できる投稿検索(D04)の API 契約を確定させる。マージ済み S8(`server/src/api_v1/personal_domain.rs` の `searchPersonalNotes`)を拡張し、入力(`author` 任意・`q` 任意)、新設の結果型、カーソル、ページ途中の変化の扱い、エラー(新設 `search_timeout` を含む)を、型・生成 OpenAPI schema・fixture・明示的な 501 route として固定する。実検索は実装しない。

## Why This Slice Exists Now

frontends は D04 の検索 UI(`from:@user` を投稿者指定へ変換する BFF/UI)を契約に準拠して作る。ユーザー決定により、検索エンジンなしの標準構成でも投稿者なしのキーワード検索を提供する(d04-q05 の「標準構成は投稿者必須」を置き換え)。現行 S8 の `searchPersonalNotes` は `q` 必須で結果が `FeedItem`(純粋リポストを含みうる)のため D04 を表現できない。

## Current Observed State

- S8(PR #19)は ShuttlePub main にマージ済み。`GET /api/v1/profiles/{profile_nanoid}/notes/search` は `q` 必須・`PageParams`・結果 `NoteSearchResponse { profile_id, items: FeedItem[], page }`。`server/tests/personal_domain.rs` と `fixtures/personal_domain/surfaces.json` は検索結果を timeline と同じ FeedItem 表現として検証している
- 投稿者指定・件数上限・時間上限・CW のみ表示・純粋リポストの型排除・カーソルの条件結び付け・ページ途中の変化の扱いは契約に無い
- frontends は S8 生成 schema を SHA pin で取り込んでいる(置き換えには新 producer SHA への pin 更新が必要)

## Accepted Baseline You May Assume

- ShuttlePub の WebAPI 定義は server 層(Axum + utoipa)で、生成 schema `openapi/shuttlepub.json` が契約の正本(S0 ADR)。ハンドラーは明示的な 501(`todo!`/`unimplemented!` は使わない)。S0 の再生成差分 CI がある
- d04-q01〜q04・q06・q07(自サーバー/他サーバーの投稿者、投稿者 1 人、キーワードなしの投稿者のみ可、部分一致、本文と CW が対象で CW 付きは畳んだまま、本人の通常・返信・コメント付き引用を含み純粋リポストは含まない)と、ユーザー決定「投稿者指定は任意、投稿者なしのキーワードだけの全体検索も標準構成で提供(DB 部分一致、件数・応答時間の上限付き、負荷対策は技術設計)」
- S8 の suppress 契約(対象 domain の mute/block 由来の投稿と、直接の引用先が対象 domain の引用を引用者のコメントごと丸ごと除外、痕跡なし)は検索にも適用。domain 判定は E8 の canonical actor ID host の完全一致
- 大文字小文字の同一視と複数語の AND は未決。契約は固定せず未決と明記する

## Target Repo / Path / Part

Repository: `ShuttlePub/ShuttlePub`

- Target paths: `server/`, `openapi/shuttlepub.json`

Target part: "S8 personal-domain の検索 route(searchPersonalNotes)を拡張する、投稿者(actor ID URL)・キーワード任意の投稿検索の入力・結果型・カーソル・エラー(型・schema・fixture・501 route)"

## In Scope

- 同じ `GET /api/v1/profiles/{profile_nanoid}/notes/search`(operationId `searchPersonalNotes`)に `author`(canonical actor ID URL、任意、1 人。acct は受けない)・`q`(任意、1〜256 文字のリテラル部分一致)・`limit`(1〜50)・`cursor`。`author` と `q` の両方が無い、`q` が空、範囲外は 400 `invalid_request`。`from:@user`→`author` の変換は UI/BFF の責務
- 検索の意味: 本文と CW が対象(引用先・返信先の本文は対象外)、% _ \ はリテラル、新しい順(`created_at` 降順、同時刻は `note_id` 降順)、検索エンジンの有無で結果の意味を変えない
- 新設結果型 `NoteSearchItem`(`post` / `reply` / `quote`)。`note_id`・`author`・`created_at`・表示本体(`text` か `content_warning` の閉じた sum 型、CW 付きは本文を返さない)。純粋リポストは型で表現不能。応答に隠した件数・注記・total を持たない
- 閲覧可能な投稿のみ(閲覧不可・削除済みは出さない)。対象 domain の author は 404/403/注記ではなく 200 空結果
- 404 not_found(未取得 author、details.field=author)、新エラー `search_timeout`(503、部分結果なし)
- カーソル: 内部は `(created_at, note_id)` の keyset で検索条件(Profile・author・q)に結び付く。不一致・破損は 400(details.field=cursor)。E8 revision の変更では失効しない
- ページ途中の編集・削除・閲覧権変更・mute/block 追加の扱い: スナップショットなし、各ページはリクエスト時点の最新状態で評価、重複を返さない、編集は順序を動かさない
- fixture(`search.json`)と test-only 参照投影、`surfaces.json` の search 検証の差し替え(timeline/notifications は維持)、型・schema・501 route テスト、docs・README の更新、`openapi/shuttlepub.json` の再生成

## Out Of Scope

- 実検索・DB 部分一致・検索エンジン連携・負荷対策・実カーソル発行・件数/時間の実計測
- 複数投稿者(OR)検索、日付・メディア種別条件、個人履歴検索、アカウント検索
- 大文字小文字の同一視・複数語 AND の確定
- `from:@user` の解析、外部 actor の取得処理
- timeline / notifications / FeedItem の変更、既存 dev API の変更、frontends の UI 実装

## Standalone Child Issue Contract

この issue の子 PR が単体で納めるもの: ShuttlePub/ShuttlePub の既存 S8 `searchPersonalNotes` を拡張し、任意の `author`・`q`・`limit`・`cursor` の入力、新設の結果型 `NoteSearchItem`(CW のみ表示・純粋リポストの型排除)、カーソルと検索条件の結び付け、ページ途中の変化の扱い、400/404/`search_timeout`(503)のエラーを、型・生成 OpenAPI schema・`search.json` fixture・明示的な 501 route として追加し、生成 schema を更新すること。実検索は実装せず、既存 S0/S3/S8 のテスト(search 検証を除く)と再生成差分 CI を含む既存 CI がグリーンであること。

## Acceptance Criteria

- 入力: `author`(actor ID URL、任意、1 人)・`q`(1〜256 文字、任意)・`limit`(1〜50)・`cursor`。`author` と `q` の両方が無い・空 `q`・範囲外・actor ID URL でない `author` は 400 `invalid_request`(details にフィールド名)。acct は受けず、`from:@user` 変換が UI/BFF の責務であることが schema 説明にある
- 検索の意味: author のみ・q のみ(投稿者なし全体検索)・両方のいずれも標準構成で提供。新しい順(`created_at` 降順、同時刻は `note_id` 降順)。本文と CW が対象、引用先・返信先本文は対象外、% _ \ はリテラル。大文字小文字・複数語 AND は未決と schema 説明・docs に明記し fixture でも固定しない
- 結果型: `NoteSearchItem` は post / reply / quote のみで純粋リポストは型として表現できない(schema・serde が拒否する fixture)。CW 付きは CW のみを返し本文を持てない。応答に隠した件数・注記・total が無い
- 閲覧可能な投稿のみ。閲覧不可・削除済みを出さない。対象 domain 由来の投稿と、直接の引用先が対象 domain の引用は痕跡なしで除外され、対象 domain の author でも 200 空結果(未取得 actor の 404 とは別)
- 404 not_found(未取得 author、details.field=author)、`search_timeout`(503、共通エラー形式、部分結果なし、author で絞れる旨を説明)が ErrorCode と検索応答 schema に追加され、503 fixture がある
- カーソルは不透明文字列で `(created_at, note_id)` の keyset と検索条件(Profile・author・q)に結び付く。条件不一致・破損は 400(details.field=cursor)。重複を返さず、E8 revision の変更で失効しない
- ページ途中の変化: スナップショットなし、各ページは最新状態で評価。編集は順序を動かさず(不一致になった投稿は以降出ず、一致になった古い投稿は出る)、削除・閲覧権喪失・mute/block 追加は以降のページで除外。返却済みページの取り消し・再配信はしない。fixture で示される
- fixture と test-only 参照投影: 通常・返信・コメント付き引用あり/純粋リポストなし、閲覧不可・削除済みなし、CW のみ(本文だけに語がある場合も)、author のみ/q のみ/両方、条件なし 400、空 q 400、404、対象 domain author の 200 空、対象 domain 引用の除外、リテラル %、ページ境界とカーソル不一致 400、ページ途中の変化、timeout 503。`surfaces.json` の search 検証は新 fixture に差し替え、timeline/notifications の検証は維持
- 全 route が明示的な 501(共通エラー形式)のまま。既存 S0/S3/S8 のテスト(search 検証を除く)が回帰せず、生成 schema(`openapi/shuttlepub.json`)が更新され再生成差分 CI がグリーン。docs・fixtures README が更新され、契約のみ・未実装が確認できる

## Verification

- 型・serialization テスト(`NoteSearchItem` の往復、repost・CW+content の拒否、`search_timeout`)
- schema テスト(入力パラメーターの範囲、結果型の closure、503 応答、dev API を含まない)と再生成差分なし
- `search.json` を schema と参照投影に照合
- 全契約 route が 501 を返す route テスト、既存 S0/S3/S8 の回帰なし
- Rust CI(fmt / clippy -D warnings / test / build / git diff --check)と openapi 再生成差分 CI がグリーン

## Related Links

- 依存ユニット: shuttlepub-openapi-foundation(ShuttlePub/ShuttlePub#14)、personal-domain-content-api-contract(ShuttlePub/ShuttlePub#18、PR #19)
- 意図: intents/shuttlepub/product/social-experience.md (I04)、intents/shuttlepub/packets/candidates.md (D04)
- 決定記録: intents/shuttlepub/interviews/discord-feature-grill-2026-10-15.json (d04-q01〜q07。q05 は thread-xxs52dcx でのユーザー決定で置き換え)、UI 側 `ui-spec.md` 5-1・5-3

## Knowledge Maintenance

- Intent placement: social-experience.md I04 節と candidates.md D04 節に本 unit の依存・到達範囲・d04-q05 の置き換えを追記(新規 intent ノード不要)
- ADR candidate: none(S0 の生成 schema 正本 ADR に従う)
- Diagram candidate: none
- Docs update: D04 に「API 契約のみ」と未決事項・ページ途中の変化の扱いを記録
- Closeout writeback expected: yes

## Guide Reachability (G645)

`guide workflow task implementation-loop` (implementation ロール) が ShuttlePub/ShuttlePub (`server/`, `openapi/shuttlepub.json`) へルーティングする。

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open all child PRs against `main` directly.
