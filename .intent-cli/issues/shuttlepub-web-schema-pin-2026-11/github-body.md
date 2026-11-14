## 親状態の注記

durable state、packet、intent、queue の正本は ShuttlePub/host のみ。frontends 側に親状態を作成しない。

## Goal

shuttlepub-web の producer schema pin を更新し (ShuttlePub `a00d234aedecb0223ba20dc8d7e9334cf9d39e83`、Emumet `c4d6ea3a4f06e924e73ffa058e5ec6e2409f1e3d`)、変更された契約 (外部絵文字の EmojiView・Hidden.cause・引用先 hidden の廃止・NoteSearch・Emumet target_actor) に既存コードを型・adapter・fixture のレベルで互換移行する。画面の見た目と新機能は後続 unit で、ここでは作らない。

## Why This Slice Exists Now

ユーザーが決めた作業順 (D09 の差分、D04 の検索画面、D08 の手直し) の準備 unit。後続の画面 unit が同じ契約・同じ生成型の上で作業できるよう、先に pin と互換移行を済ませる。

## Current Observed State

- shuttlepub-web の pin は ShuttlePub `60cb47d6…` と Emumet `82fa49b3…` のまま。ShuttlePub #21 (外部絵文字)・#23 (NoteSearch)・#25 (Hidden.cause・引用先 hidden の廃止)・#27 と Emumet #106 (target_actor) の契約は取り込まれていない
- 契約変更の影響: EmojiView に origin/image_state/usage、EmojiReactionCount に view、PUT reaction に 409 conflict と 422 emoji_usage_not_allowed、hidden に cause 必須、引用先 (EmbeddedNotePresentation) から hidden 削除、検索の応答形、ProfileRelation.target_actor 必須

## Accepted Baseline You May Assume

- durable state、packet、intent、queue の正本は ShuttlePub/host のみ。frontends 側に親状態を作成しない。
- schema 取込は F0 の方式 (producer commit のフル SHA + checksum で固定した生成 OpenAPI → TS 型 → アプリ所有 GraphQL SDL → PureScript 型、fixture は OpenAPI に照合)。schema は手編集せず `bun run openapi:sync` / `openapi:sync-scenarios` / `codegen` で再生成する。短縮 SHA で推測しない。
- pin 先: ShuttlePub は #21・#23・#25・#27 をすべて含む main、Emumet は #106 を含む main (どちらも PR 作成時点の最新 main のフル SHA)。
- 型を通すための架空値・as による回避をしない。契約の項目は欠落なく保持し、欠けた応答は契約違反として扱う。
- ユーザー決定済みの作業順の準備 unit。マージは独立レビュー後にリードが指示する。

## Target Repo / Path / Part

Repository: `ShuttlePub/shuttlepub-frontends`

- Target paths: `apps/shuttlepub-web, apps/ui-catalog/visual/screens`

Target part: `producer schema pin と、Emoji 新情報・Hidden.cause・QuotedPost・target_actor・検索契約への型/adapter/fixture の互換移行 (新画面・新表示は後続 unit)`

## In Scope

- ShuttlePub / Emumet の pin 更新 (openapi・scenario・fixture の同期、codegen の再生成)
- Emoji の origin/image_state/usage と集計チップの view を REST → GraphQL → PureScript まで保持 (外部絵文字の 422/409 のエラー経路を含む)
- Hidden.cause を hidden 専用型で保持、QuotedPost.hidden と旧 embedded-hidden 分岐の削除 (引用先が制御対象なら引用した投稿全体が cause=quote で隠れる)
- Emumet target_actor を一覧・作成応答の両方で保持
- NoteSearch 契約への旧 searchFor の追従、producer fixture の再生を新しい意味へ更新
- 契約変更で壊れる既存表示の最小追従 (PR 本文に列挙)、README の追従

## Out Of Scope

- D09 (外部絵文字の地球マーク等の表示)・D04 (検索画面)・D08 (行表示・引用文言の変更) の画面の見た目と新機能
- 未取込 fixture (note_search_author・quick_reaction/schema_cases) の取込 (D04 等の後続 unit)
- 実 Emumet E2E の Emumet revision pin (`e2e/emumet-revision`) の更新

## Standalone Child Issue Contract

shuttlepub-web の producer schema pin を ShuttlePub `a00d234aedecb0223ba20dc8d7e9334cf9d39e83`・Emumet `c4d6ea3a4f06e924e73ffa058e5ec6e2409f1e3d` (PR 作成時点の最新 main) に更新し、Emoji 新情報・Hidden.cause・QuotedPost・target_actor・検索契約を型・adapter・fixture に欠落なく反映する。既存の画面は壊さず、契約変更で必要な最小限の追従だけを行い PR 本文に列挙する。新しい見た目・新機能は作らない。

## Acceptance Criteria

1. openapi/producer.lock.json が 2 つのフル SHA を指し、`bun run openapi:verify` が通る。それぞれ PR 作成時点の最新 main である。
2. EmojiView の origin/image_state/usage と EmojiReactionCount の view が REST → GraphQL → PureScript まで保持され、422 emoji_usage_not_allowed・409 conflict が既存のエラー経路で扱われる。画面の見た目は変えない。
3. Hidden.cause は hidden 専用型で保持し、汎用 ContentControl には足さない。QuotedPost.hidden と旧 embedded-hidden 分岐は削除され、引用先が制御対象なら引用した投稿全体が cause=quote で隠れ、reveal で引用先も表示される。
4. target_actor を個人 mute/block の一覧と作成応答の両方で保持し、欠けた応答は契約違反として拒否する。表示は変えない。
5. NoteSearch 契約に旧 searchFor が追従し、producer fixture の再生が新しい意味で通る。旧仕様のテストを放置しない。
6. purs-tidy check、openapi:verify、codegen:check、spago build/test、bun test、tsc --noEmit、既存 E2E・visual が通り、既存 CI がグリーン。
7. PR 本文に、最小限追従した既存表示の一覧と、後続 unit への申し送りを載せる。

## Verification

- `purs-tidy check apps/shuttlepub-web/src apps/shuttlepub-web/test`、`bun run openapi:verify`、`bun run codegen:check`、`bunx spago build`、`bunx spago test`、`bun test`、`bunx tsc --noEmit` (apps/shuttlepub-web)
- apps/ui-catalog の `bun test`・visual の shuttlepub-verify と capture、E2E の cookie-isolation
- 既存 CI (check / e2e / frontend-visual) がグリーン、`git diff --check`

## Related Links

- 契約: ShuttlePub/ShuttlePub#21・#23・#25・#27、ShuttlePub/Emumet#106
- 意図: intents/shuttlepub/product/social-experience.md、intents/shuttlepub/packets/candidates.md
- 先行 PR: ShuttlePub/shuttlepub-frontends#46 (D08 第2段)

## Knowledge Maintenance

- Intent placement: 新規 intent ノード不要。到達範囲は candidates.md に追記
- ADR candidate: none
- Diagram candidate: none
- Docs update: pin 先の完全 SHA と後続 unit への申し送りを candidates.md に記録
- Closeout writeback expected: yes

## Guide Reachability (G645)

`guide workflow task implementation-loop` (implementation ロール) が ShuttlePub/shuttlepub-frontends (`apps/shuttlepub-web`) へルーティングする。

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open all child PRs against `main` directly.
