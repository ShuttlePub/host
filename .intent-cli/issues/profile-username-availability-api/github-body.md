## 親状態の注記

durable state、packet、intent、queue の正本は ShuttlePub/host のみ。Emumet 側の旧 design-host 記述を根拠に child へ親状態を作成しない。

## Goal

認証必須の Profile username 空き確認 API `GET /api/v1/profiles/username-availability?username=...` を追加する。形式不正・予約語・使用中/削除済み (再利用不可) を判定して `{ username, available, reason? }` を返す。読取専用、レート制限付き。

## Why This Slice Exists Now

FN (`profile-identity-web-adaptation`、shuttlepub-frontends#34、emumet-web) の username 入力中検証で、形式・予約語に加えて重複も判定できるようにするため。現状は username の重複が作成/設定時の 409 でしか分からない。計画外の追加 unit (ユーザー承認 question-66c258dd659b42f5ed0c13ae2c29fdf5)。

## Current Observed State

- username は P1 でマージ済み: 作成時指定 (`POST /api/v1/accounts` の `profile_username`、`POST /api/v1/profiles` の `username`) と一回限り設定 (`POST /api/v1/profiles/{profile_nanoid}/username`)。形式 `^[a-z0-9][a-z0-9._-]{0,63}$` と予約語 17 語は `kernel` の `ProfileUsername::check`、暗黙変換なし
- 一意性は `profile_events` の部分 unique index `profile_events_username_unique` (`(data ->> 'username') WHERE ... IS NOT NULL`) が DB 保証。`profile_events` は append-only で Profile/Account 削除後も残るため、削除済みの username も再利用できない。違反は `Concurrency` → 409
- 事前に重複を調べる API はない。HTTP リクエスト単位のレート制限機構も Emumet にはない
- 実装は `ProfileEventStore` (実装は `PostgresProfileEventStore` のみ、`DependOnProfileEventStore` 配線済み) に読取メソッドを足せば足りる

## Accepted Baseline You May Assume

- P1: username の規則・DB 保証・作成/設定 API の 400 / 409 の挙動
- `/api/v1` は JWT 認証 middleware 配下 (未認証 401)

## Target Repo / Path / Part

Repository: `ShuttlePub/Emumet`

- Target paths: `kernel/src/event_store/profile.rs`, `driver/src/database/postgres/profile_event_store.rs`, `application/src/service/profile_username_availability.rs` (新規), `application/src/service.rs`, `server/src/api/profile_username_availability.rs` (新規), `server/src/route/profile_username_availability.rs` + 同名ディレクトリのレート制限 (新規), `server/src/schema/profile_username_availability.rs` (新規), `server/src/root_router.rs`, `server/src/openapi.rs`, `server/src/route.rs`, `server/src/api/mod.rs`, `server/src/schema.rs`, `server/src/route/account/client_username_availability_tests.rs` (新規), `openapi.json`

Target part: 入力中検証用の username 空き確認 endpoint (認証必須、レート制限付き、読取専用)

## In Scope

- `GET /api/v1/profiles/username-availability?username=...`: 200 `{ username, available, reason? }`。`reason` は `invalid_format` / `reserved` / `taken`。`taken` は使用中と削除済み (再利用不可) を区別しない (列挙攻撃・プライバシー配慮、PR に明記)
- 判定規則は P1 と同一 (`ProfileUsername::check` を流用、暗黙変換なし)。使用中/削除済みは `profile_events` の `data ->> 'username'` の存在確認 (unique index と同じ判定源)。形式不正・予約語は DB を引かない
- username パラメータ欠落は 400。副作用なし (イベント・Account・auth account を作らない)
- レート制限: JWT の (iss, sub) 単位の in-process スライディングウィンドウ (既定 60 回/分)、超過は 429 + `Retry-After`、超過分は窓に数えない、ユーザー独立、期限切れキーの掃除。インスタンス単位であることを明記
- API の description に「可用性は参考値で、最終判定は作成/設定時の 400 / 409。確認から送信までに他者が取れば 409 になりうる。予約はしない」を明記
- OpenAPI 再生成 (新スキーマと 400 / 401 / 429 の応答を登録)
- 実 DB の route test と limiter の単体テスト

## Out Of Scope

- username の変更、予約 (ホールド) 機能
- 新しい DB migration・DependOn・AppModule 変更
- P4 (PR #91、未マージ・承認済み) と重複する変更。変更は新規ファイル中心とし、共有ファイルは数行の追加のみ

## Standalone Child Issue Contract

認証必須の `GET /api/v1/profiles/username-availability` を追加し、形式不正 (`invalid_format`)・予約語 (`reserved`)・使用中/削除済み (`taken`、両者は区別しない)・空き (available=true) を 200 で返す。判定規則は P1 と同じで、判定源は `profile_events` の unique index と同じ。作成/設定 API の判定 (400 / 409) と一致させる。レート制限は (iss, sub) 単位の in-process で、超過は 429 + `Retry-After`。可用性は参考値で最終判定は作成/設定時の 400 / 409 であることを API 説明と PR に明記する。`openapi.json` を再生成し、実 DB テストで検証する。

## Acceptance Criteria

1. 未認証 (Authorization なし・不正トークン) は 401。`username` パラメータ欠落は 400 (実 DB の route test)
2. 空き (reason なし)・形式不正 (大文字・前後空白・空文字・先頭が記号・65 文字・`@` など)・予約語 (17 語すべて)・使用中 (作成時指定 / 一回限り設定で保存済み)・削除済み (Account 無効化で Profile 投影行が消えた後も `taken`) の各ケースが期待どおり。使用中と削除済みの応答は区別できない
3. 作成/設定 API の判定と一致: 同じ入力で、`invalid_format`・`reserved` は `POST /api/v1/accounts` の `profile_username` と `POST /api/v1/profiles/{profile_nanoid}/username` が 400、`taken` は 409、available は成功 (実 DB で 5 ケース)。暗黙変換がない
4. 判定源が DB の unique index と同じ (作成時指定・一回限り設定の両経路)。確認は副作用なし (`profile_events`・`accounts`・`auth_accounts` の行数が前後で不変)
5. レート制限: ユーザー単位で超過が 429 + `Retry-After`、別ユーザーは影響なし、窓経過で回復、超過リクエストは窓に数えない、キー掃除でメモリ有界 (単体テスト)
6. API の description と PR に、参考値であること・予約しないこと・使用中と削除済みを区別しないこと・制限が in-process でインスタンス単位であること・username 変更は範囲外であることを明記
7. 新しい migration・DependOn・AppModule 変更なし。既存 endpoint の挙動不変。`openapi.json` を再生成し `openapi_spec_matches_committed_file` と CI の openapi-check が通る。`DATABASE_URL` を設定した実 DB テストが skip ではなく実行・パスし、既存 Rust CI (fmt / clippy / test) が通る

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
- Closeout writeback expected: yes — path・応答形・reason 種別・制限方式と値・判定源の確定形 (host 側で記録)

## Guide Reachability (G645)

implementation-loop ガイド (host) → implementation ロール → ShuttlePub/Emumet の REST 読取 endpoint (`GET /api/v1/profiles/username-availability`、`openapi.json`)。

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open all child PRs against `main` directly.
