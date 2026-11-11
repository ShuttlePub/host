# profile-identity-read-exposure Implementation Packet

> **親状態の注記**: durable state、packet、intent、queue の正本は ShuttlePub/host のみ。Emumet 側の旧 design-host 記述を根拠に child へ親状態を作成しない。

## Goal

`AccountResponse` に `profile_id` (Profile nanoid) と `profile_username` (未設定は null) を追加し、ログイン中の個人 Account の Profile 識別子をクライアントが取得できるようにする。読取専用の追加。

## Why

FN (shuttlepub-frontends#34) が既存 Profile への一回限り username 設定 (`POST /api/v1/profiles/{profile_nanoid}/username`) や Profile 単位 API 呼出しで対象 Profile を特定するために必要。計画外の追加 unit (ユーザー承認 question-da4ae5d616cf6197f307bfffdc86868a)。FN と P4 (PR #91) の前にマージする。

## Scope

- `AccountDetailDto` / `into_detail` / `compose_account_details` (read.rs) / `update_account_detail_authorized` (update.rs) / `AccountResponse` / `account_dto_to_response` に 2 項目を追加。全 AccountResponse 経路 (GET 一覧・ids・個別、POST 作成、PATCH 更新) に反映
- 組織 Account が複数 Profile を持つ場合、表示 Profile を決定的にする (account あたり最小 profile id)。read と update で同じ規則。表示項目と `profile_id` は同一 Profile から返す
- AccountResponse の schema 説明文に追加項目の意味を記載し、`openapi.json` を再生成
- 実 DB の route test: 個人 (username あり/なし)、取得/一覧/ids/作成/更新、他人の Account、無効化・停止・BAN、Profile 移管後、複数 Profile の組織 Account
- PR に組織 Account の扱いを明記

## Out of scope

- 新しい endpoint・permission・username 更新手段・Profile 一覧 API
- 移管元の個人 Account の Profile 欠落時の既存挙動 (NotFound) の変更
- P4 (PR #91) と重複する変更。Account 関連ファイルは最小限の差分に留める

## Verification

- `DATABASE_URL` を設定した実 DB の route test (skip のみ不可)
- `cargo test -p server write_openapi_spec_to_file -- --ignored` で再生成し `git diff --exit-code openapi.json`、`openapi_spec_matches_committed_file`
- `cargo fmt --check`、`cargo clippy`、`cargo test`、`git diff --check`

## Revision history

- 2026-11-11: 公開直後に、停止・BAN 中の Account の可視性の記述を実装 (driver の find_by_nanoids は停止・BAN・無効化を除外、find_by_auth_id は無効化のみ除外) に合わせて訂正。issue #94 の本文も同期。

## Knowledge Maintenance (G461)

- Intent placement: `intents/emumet/features/profile-federation/overview.md` (primary)
- ADR candidate: なし
- Diagram candidate: なし
- Docs update: なし
- Closeout learning: 応答フィールドの確定形、組織 Account の選択規則、移管後・停止中・無効化中の挙動を PF packets.md / acceptance.md へ書き戻す (`write_back_required: true`、host 更新は親が行う)
- Guide reachability (G645): implementation-loop ガイド → implementation ロール → REST 読取応答 (`AccountResponse`、`openapi.json`)
