## 親状態の注記

durable state、packet、intent、queue の正本は ShuttlePub/host のみ。Emumet 側の旧 design-host 記述を根拠に child へ親状態を作成しない。

## Goal

D08 (個人単位の domain block/mute) と Profile 単位 federation 移行の契約 unit。Profile identity・Follow・個別 block/mute・domain-controls の認可・revision・エラーを OpenAPI として確定し、`username` の段階移行を契約に明記する。**契約のみ**で、実処理は含まない。

## Why This Slice Exists Now

後続の P1 (username 実保存)・P2 (保存モデル)・D8P (domain 方針保存)・ShuttlePub S8・frontends FN/F8 が同じ契約を参照して並行できるようにするため。

## Current Observed State

- `POST /api/v1/accounts` は `{name, is_bot}`、`POST /api/v1/profiles` は `{display_name, summary}`。どちらも username を持たない
- Account 単位 actor が前提 (ADR 0002 は 1 Profile = 1 actor を採用済みだが実装が未追従)
- domain 単位の mute/block は存在しない (既存 block/mute は Account 個別対象)

## Accepted Baseline You May Assume

- D08 ユーザー決定: Profile 単位、完全一致 domain のみ、mute は表示抑制のみ、block は双方向 Follow 解除＋新規操作拒否 (解除しても関係は復元しない)、AP Block は送らない
- 新規 Follow の受理・送信拒否は Emumet、返信・引用・リポスト・いいね／絵文字の受理・送信拒否は ShuttlePub 本体の後続責務
- 旧連合 identity は破棄 (in-place reset は P4)。P1〜P3 の Profile actor・関係 route は本番 root router へ未 mount

## Target Repo / Path / Part

Repository: `ShuttlePub/Emumet`
Path: `server/src/openapi.rs`, `server/src/openapi/`, `server/src/schema/`, `server/src/route/account/mod.rs`, `openapi.json`
Part: OpenAPI 契約と作成 API の username 段階移行

## Acceptance Criteria

1. OpenAPI に Profile identity・Follow・個別 block/mute・domain-controls の route/schema が定義され、認可 (現在の所有者のみ)・revision (競合)・エラー (401/403/404/409/422/501 等) が明記されている
2. `POST /api/v1/accounts` の `profile_username` と Profile 作成の `username` は P4 まで optional。指定時は形式 `^[a-z0-9][a-z0-9._-]{0,63}$`・予約語 (admin, administrator, root, system, support, security, moderator, api, ap, auth, oauth, oauth2, login, logout, register, settings, well-known) を検証 (暗黙の trim・小文字化なし)。保存未実装の間は作成副作用の前に明示的な未実装エラーを返し、指定値を黙って捨てない。省略した旧 payload は従来どおり成功する
3. Profile 読取表現の username は未設定を表現できる。将来用 Profile actor・Follow・domain-controls route が本番未 mount であることが schema/route 説明文に記載されている
4. 外部 ID は nanoid。username 更新 API を通常の編集機能として設けない
5. 新しい関係処理・方針保存・username 保存の実装を含まず、本番 root router に新 route を mount しない
6. `openapi.json` 再生成で `openapi_spec_matches_committed_file` が通り、旧作成 payload・新 payload・未実装エラー (副作用なし) の contract test が追加され、既存 Rust CI が通る

## In Scope

- OpenAPI route/schema/説明文、作成 API の username 検証と未実装エラー、contract test、`openapi.json` 再生成

## Out Of Scope

- 関係処理・domain 方針保存・username 保存の実装、本番 router への mount、配送 worker (P1/P2/P3o/P3i/P4/D8P/D8G/D8R)
- username 更新 API
- ShuttlePub 側の投稿制御

## Verification

- OpenAPI 再生成と一致テスト、contract test (旧 payload / 新 payload / 形式・予約語違反 / 未実装エラーで副作用なし)、既存 Rust CI

## Related Links

- host: `intents/emumet/features/personal-domain-controls/`、`intents/emumet/features/profile-federation/`、`intents/shuttlepub/packets/candidates.md` (D08)
- Emumet ADR 0002 / 0003 / 0007

## Standalone Child Issue Contract

Emumet の OpenAPI 契約として、Profile identity・Follow・個別 block/mute・domain-controls (Profile × 完全一致 domain の mute/block) の route/schema・認可・revision・エラーを定義し、`POST /api/v1/accounts` の `profile_username` と Profile 作成の `username` を optional で追加する (指定時は検証し、保存未実装の間は作成副作用前に明示的な未実装エラー。黙って無視しない)。実処理・username 保存・本番 mount は含まない。`openapi.json` を再生成し、旧 payload・新 payload・未実装エラーの contract test を追加する。

## Merge Order

共有ファイル (`server/src/openapi.rs`, `route.rs`, `main.rs`, DI, `migrations/`, `openapi.json`) は D15 の E15a `registration-gate-control-plane` のマージ後に main へ rebase し、`openapi.json` を再生成してからマージする。

## Knowledge Maintenance

- Intent placement: host の `intents/emumet/features/personal-domain-controls/overview.md` (primary) / profile-federation (supporting)
- ADR candidate: なし
- Diagram candidate: なし
- Docs update: なし (契約・検証境界は host の DC acceptance.md に記録済み)
- Closeout writeback expected: yes — username 段階移行と未実装エラーの確定形 (host 側で記録)

## Guide Reachability (G645)

implementation-loop ガイド (host) → implementation ロール → ShuttlePub/Emumet の REST API 契約 (POST /api/v1/accounts, POST /api/v1/profiles, openapi.json)。

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open all child PRs against `main` directly.
