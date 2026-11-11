## 親状態の注記

durable state、packet、intent、queue の正本は ShuttlePub/host のみ。Emumet 側の旧 design-host 記述を根拠に child へ親状態を作成しない。

## Goal

ログイン中の個人 Account に属する Profile の識別子 (nanoid) と username をクライアントが取得できるよう、`AccountResponse` に `profile_id` と `profile_username` (未設定は null) を追加する。読取専用の追加で、新しい endpoint は作らない。

## Why This Slice Exists Now

FN (`profile-identity-web-adaptation`、shuttlepub-frontends#34) が既存 Profile への一回限り username 設定 (`POST /api/v1/profiles/{profile_nanoid}/username`、P1 マージ済み) や Profile 単位 API 呼出しで対象 Profile を特定するために必要。現状の `AccountResponse` は Profile の nanoid も username も返さない。計画外の追加 unit (ユーザー承認 question-da4ae5d616cf6197f307bfffdc86868a)。FN と P4 (PR #91、未マージ) の前にマージする。

## Current Observed State

- `AccountResponse` の項目は id/name/display_name/summary/icon_url/banner_url/is_bot/fields/created_at/moderation。Profile 識別子なし
- `AccountResponse` を返す経路は `GET /api/v1/accounts` (ids 指定・cursor 一覧)、`GET /api/v1/accounts/{account_id}`、`POST /api/v1/accounts`、`PATCH /api/v1/accounts/{account_id}`。すべて `AccountDetailDto` (`read.rs` の `compose_account_details`、`update.rs` の `update_account_detail_authorized`) から `account_dto_to_response` で変換される
- 個人 Account は個人 Profile を 1 件、組織 Account は複数 Profile を持ちうる。Profile 移管は Profile の `account_id` を移管先の組織 Account へ付け替える。組織 Account が複数 Profile を持つ場合の表示 Profile は現状 HashMap 構築順で不定

## Accepted Baseline You May Assume

- P1: Profile の `nanoid()` / `username()` が projection にあり、username は一回限り設定後不変
- 認可・可視性は既存の Account 取得 (`account_view` 権限、無効化 Account は全経路で除外、停止・BAN 中の Account は ids 指定・個別取得では除外され所有者の cursor 一覧だけが moderation 付きで返す) を変えない

## Target Repo / Path / Part

Repository: `ShuttlePub/Emumet`

- Target paths: `application/src/dto/account.rs`, `application/src/service/account_detail/read.rs`, `application/src/service/account_detail/update.rs`, `server/src/schema/account.rs`, `server/src/route/account/client_tests.rs`, `openapi.json`

Target part: Account 取得・一覧・作成・更新の応答に `profile_id` / `profile_username` を追加する読取専用の追加

## In Scope

- `AccountDetailDto` と `AccountResponse` に `profile_id` (Profile nanoid) と `profile_username` (null 可) を追加し、全 AccountResponse 経路に反映
- 組織 Account が複数 Profile を持つ場合の表示 Profile を決定的にする (account あたり最小 profile id)。read と update で同じ規則を使う。表示項目と `profile_id` は同一 Profile から返す
- OpenAPI 再生成と schema 説明文、実 DB の route test
- PR に組織 Account の扱いを明記

## Out Of Scope

- 新しい endpoint、permission、username 更新手段、Profile 一覧 API
- 移管元の個人 Account で Profile が欠落する場合の既存挙動 (NotFound) の変更
- P4 (PR #91) と重複するリファクタ。Account 関連ファイルへの変更は最小限にする

## Standalone Child Issue Contract

`AccountResponse` に `profile_id` (Profile nanoid) と `profile_username` (未設定は null) を追加し、Account 取得・一覧・作成・更新のすべての応答に反映する。既存フィールドと挙動は不変 (追加のみ)。認可は既存の Account 取得と同じで、他人の Account の Profile 識別子は返さない。無効化・停止中の扱いは既存と一致させ、Profile 移管後は移管先の所有関係に従う。組織 Account の複数 Profile は決定的に 1 件を選び PR に明記する。`openapi.json` を再生成し、実 DB テストで検証する。

## Acceptance Criteria

1. `AccountResponse` を返す全経路に `profile_id` (文字列) と `profile_username` (文字列または null) が含まれる
2. 既存フィールド・ステータスは変更されない (追加のみ)。既存テストと OpenAPI 検証が追加分以外の差分なしで通る
3. 個人 Account で正しい nanoid と username (未設定は null)。作成直後・取得・一覧・ids 指定・更新後を実 DB で検証
4. 認可は既存の Account 取得と同じ。他人の Account の Profile 識別子はどこにも露出しない (実 DB で検証)
5. 無効化は既存どおり全経路で返らず、停止・BAN 中は既存どおり ids 指定・個別取得では返らず所有者の cursor 一覧だけが moderation 付きで返り、その項目に Profile 識別子も含まれる (実 DB で検証)
6. Profile 移管後は移管先の組織 Account の応答に現れ、移管元の個人 Account の応答には現れない (実 DB で検証)
7. 組織 Account の扱いを PR に明記。複数 Profile でも表示 Profile と `profile_id` が同一で決定的、GET と PATCH で一致 (実 DB で検証)
8. `openapi.json` 再生成、`openapi_spec_matches_committed_file` と CI の openapi-check が通る。`DATABASE_URL` を設定した実 DB テストが skip ではなく実行・パスし、既存 Rust CI (fmt / clippy / test) が通る

## Verification

- 実 DB の route test (`DATABASE_URL`)、`cargo test -p server write_openapi_spec_to_file -- --ignored` による再生成と `git diff --exit-code openapi.json`、`cargo fmt --check`、`cargo clippy`、`git diff --check`

## Related Links

- host: `intents/emumet/features/profile-federation/` (overview / packets / acceptance)、`intents/emumet/decisions/profile-actor-identity.md`、`intents/shuttlepub/packets/candidates.md` (D08)
- shuttlepub-frontends#34 (FN)、Emumet PR #91 (P4、未マージ)

## Knowledge Maintenance

- Intent placement: host の `intents/emumet/features/profile-federation/overview.md` (primary)
- ADR candidate: なし
- Diagram candidate: なし
- Docs update: なし
- Closeout writeback expected: yes — 応答フィールドの確定形、組織 Account の選択規則、移管後・停止中・無効化中の挙動 (host 側で記録)

## Guide Reachability (G645)

implementation-loop ガイド (host) → implementation ロール → ShuttlePub/Emumet の REST 読取応答 (`GET /api/v1/accounts`、`GET /api/v1/accounts/{account_id}`、`POST /api/v1/accounts`、`PATCH /api/v1/accounts/{account_id}` の `AccountResponse`、`openapi.json`)。

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open all child PRs against `main` directly.
