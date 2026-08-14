## Goal

ADR 0006 Stage 6. AuthAccount を Event Sourcing から CRUD に移行する。

具体的には: find-or-create を `INSERT ... ON CONFLICT (host_id, client_id) DO NOTHING`
ベースの単一原子的操作に置き換え、コマンドパス内の同期 projection 書き込み例外と
Redis リペア経路 (`auth_account_applier` / `UpdateAuthAccount`) を除去し、
ES 基盤 (`AuthAccountEvent` / `AuthAccountEventStore` / adapter の processor) を削除する。
既存 `auth_account_events` のデータ移行 (auth_accounts への fold 補完 + テーブル drop)
を含む。

## Why This Slice Exists Now

ADR 0006 決定8 で確定済みの移行。AuthAccount のイベントは `Created { host, client_id }`
の1種類のみで履歴価値がなく (ログイン履歴は Kratos 側の責務)、ES 維持の実益がない。
一方で現行の find-or-create は「read model 検索 → イベント書込 → 同期投影 INSERT」の
3手順で、イベント INSERT は id 単位ガードのため並行リクエストが両方成功しうる。
その場合 `auth_accounts` の `UNIQUE(host_id, client_id)` 衝突で片方がエラーになり、
Signal → Redis applier リペアという迂回が常設されている。
この例外経路は adapter クレート解体 (決定1) と projection 一本化 (決定4/6) の
障害になっており、Stage 7 (Profile/Metadata 移行) と Stage 8 (adapter 削除) の前提でもある。

## Current Observed State

- `AuthAccount` は `kernel/src/entity/auth_account.rs` の ES 集約。イベントは
  `Created { host, client_id }` のみ (event_name = `auth_account_created`)、
  entity は `version: EventVersion<AuthAccount>` を内包する。
- port は `AuthAccountEventStore` (`kernel/src/event_store/auth_account.rs`) と
  `AuthAccountReadModel` (`kernel/src/read_model/auth_account.rs`) の旧来2系統。
  `AggregateRepository<AuthAccount>` は存在しない。
- コマンド経路は `adapter/src/processor/auth_account.rs` の
  `AuthAccountCommandProcessor::create`: ①event `persist_and_transform` (id 単位ガード)
  ②apply ③read model 同期 `create` ④Signal emit (成功/失敗両パス)。
  ③が同期 projection 例外の本体。
- find-or-create 入口は `server/src/auth.rs` の `resolve_auth_account_id`
  (全認証ルートから呼ばれる)。miss 時に AuthHost find-or-create →
  `AuthAccountCommandProcessor::create` の順で実行される。
- リペア経路: `server/src/applier/auth_account_applier.rs` が Redis channel
  `auth_account_applier` を消費し `UpdateAuthAccount`
  (`application/src/service/auth_account.rs`) を呼ぶ。AuthAccount 用の
  tailing projector は存在しない (seq index / checkpoint 登録なし)。
- スキーマ: `auth_accounts` は `UNIQUE(host_id, client_id)` あり
  (`migrations/20230707210300_init.sql`)。`auth_account_events` は PK(id, version) +
  `seq BIGSERIAL` (20260813000001)。
- `find_by_client_id` (`driver/src/database/postgres/auth_account.rs`) は
  host 絞り込みなしで client_id のみで検索する。
- 下流消費者 (CreateAccount の `link_auth_account` + Keto Owner、session_context、
  permission check、`find_by_auth_id`、AccountProjector) は AuthAccountId のみに依存し、
  永続化方式変更の影響を受けない。

## Accepted Baseline You May Assume

- ADR 0006 全体 (決定1: 層の定義と adapter 解体、決定3: 4系統の port 文法 — CRUD
  repository は `ExpectedVersion` / `Rehydrated` を擬装しない、決定8: AuthAccount
  ES→CRUD、決定9: domain/projection 分離、決定10: 命名正規化)。
- Stage 1-5 完了済み (PR #25 / #27 / #29 / #31 / #33 マージ済み)。
  `TransactionManager` port、CRUD 冪等操作 (`insert_if_absent` 等) の系統、
  AccountProjector による projection 一本化は確定済み。
- rust-toolchain は 1.97.0。DB テストは `#[test_with::env(DATABASE_URL)]` で
  Postgres 16 相手に実行。
- 移行と挙動変更は別 commit に分離する (ADR §10)。parallel change を徹底し
  main green を維持する。

## Target Repo / Path / Part

Repository: `ShuttlePub/Emumet`

Target paths: `kernel/src/entity/auth_account.rs, kernel/src/event_store/auth_account.rs, kernel/src/read_model/auth_account.rs, kernel/src/repository/, kernel/src/lib.rs, kernel/src/test_utils/event.rs, adapter/src/processor/auth_account.rs, application/src/service/auth_account.rs, application/src/service.rs, driver/src/database/postgres/auth_account.rs, driver/src/database/postgres/auth_account_event_store.rs, server/src/auth.rs, server/src/applier.rs, server/src/applier/auth_account_applier.rs, server/src/handler.rs, server/src/route/test_mode.rs, server/tests/support/db.rs, migrations/`

Target part: AuthAccount の ES→CRUD 移行 (find-or-create ON CONFLICT 原子化・同期 projection 例外と Redis リペア経路の除去・auth_account_events データ移行)

## In Scope

- kernel に CRUD repository port `AuthAccountRepository` を新設 (決定3 の CRUD 系統)。
  `find_or_create(host_id, client_id)` / `find_by_id` を持ち、`AuthAccountReadModel`
  port はこれに吸収または置換する。
- find-or-create を `INSERT ... ON CONFLICT (host_id, client_id) DO NOTHING` ベースの
  単一原子的操作に置き換え (既存 UNIQUE 制約を利用)。driver Postgres 実装を追加。
- `resolve_auth_account_id` を書き換え: AuthHost find-or-create (既存のまま) 後に
  (host_id, client_id) の組で AuthAccount を find_or_create。EventStore /
  CommandProcessor / QueryProcessor 経由を廃止。
- 同期 projection 例外の除去: `AuthAccountCommandProcessor` / `AuthAccountQueryProcessor`
  (adapter/src/processor/auth_account.rs)、`UpdateAuthAccount`
  (application/src/service/auth_account.rs)、`AuthAccountApplier` +
  `auth_account_applier` Redis queue (server/src/applier.rs,
  server/src/applier/auth_account_applier.rs)、`DependOnAuthAccountSignal` 配線
  (server/src/handler.rs) を削除。
- ES 基盤の削除: `AuthAccountEvent` / `EventApplier for AuthAccount` /
  `AuthAccountEventStore` port + Postgres 実装 + テスト helper
  (kernel/src/test_utils/event.rs の auth_account_create_command 等)。
  `AuthAccount` entity は `EventVersion` を持たない plain な構造体にする。
- データ移行マイグレーション: 既存 `auth_account_events` を `auth_accounts` に fold
  して欠損行を補完し、`auth_account_events` テーブルを drop。
  `auth_accounts.version` 列の扱い (drop or 残置+default) は実装で確定する。
- test_mode / e2e support の TRUNCATE 対象から auth_account_events を除外。
- 関連するユニット / integration テストの追加・修正・削除。

## Out Of Scope

- Profile / Metadata の ES 移行 (Stage 7)。
- route facade newtype 化・委譲マクロ集約・adapter クレート自体の削除 (Stage 8。
  本 Stage で adapter/src/processor/auth_account.rs は削除するが、adapter クレート
  自体は Account processor 等が残るため存続する)。
- AuthHost の CRUD 化・フロー変更 (find-or-create by url は既存のまま維持)。
- Keto provisioning・権限モデルの変更 (AuthAccountId は引き続き subject として使う)。
- Kratos / Hydra / OAuth2 フロー自体の変更。
- 命名正規化 (ADR §10) のうち本 Stage に直接関係しないもの
  (`Executor` → `Connection` rename 等)。

## Standalone Child Issue Contract

This issue asks the child implementation repo to migrate AuthAccount from Event
Sourcing to CRUD: replace the three-step find-or-create (read-model lookup, event
insert, synchronous projection insert) with a single atomic
`INSERT ... ON CONFLICT (host_id, client_id) DO NOTHING`-based operation behind a
new kernel CRUD repository port; remove the synchronous projection exception and
its Redis repair path (`AuthAccountApplier`, `auth_account_applier` queue,
`UpdateAuthAccount`); delete the ES infrastructure (`AuthAccountEvent`,
`AuthAccountEventStore`, adapter processors) so the `AuthAccount` entity is a plain
struct without `EventVersion`; and ship a data migration that folds existing
`auth_account_events` rows into `auth_accounts` and drops the events table.
The authentication flow (Kratos login → Hydra → JWT → `resolve_auth_account_id`)
must keep working, and tests must stay green with `main` green throughout.

## Acceptance Criteria

- A new kernel CRUD repository port `AuthAccountRepository` exists (per ADR decision 3;
  no `ExpectedVersion` / `Rehydrated` pretense) with at least
  `find_or_create(host_id, client_id)` and `find_by_id`; `AuthAccountReadModel` is
  absorbed into or replaced by it.
- find-or-create is a single atomic operation based on
  `INSERT ... ON CONFLICT (host_id, client_id) DO NOTHING` (using the existing UNIQUE
  constraint). A test demonstrates that concurrent calls with the same
  (host_id, client_id) return the same id and leave exactly one row in auth_accounts.
- `resolve_auth_account_id` performs AuthHost find-or-create (unchanged) and then
  AuthAccount find_or_create by the (host_id, client_id) pair, without going through
  the EventStore / command / query processors.
- The synchronous projection exception is removed: `AuthAccountCommandProcessor` /
  `AuthAccountQueryProcessor` (adapter/src/processor/auth_account.rs),
  `UpdateAuthAccount` (application/src/service/auth_account.rs), `AuthAccountApplier`
  and the `auth_account_applier` Redis queue (server/src/applier*), and the
  `DependOnAuthAccountSignal` wiring (server/src/handler.rs) are deleted.
- The ES infrastructure is deleted: `AuthAccountEvent`, `EventApplier for AuthAccount`,
  the `AuthAccountEventStore` port and its Postgres implementation, and related test
  helpers. The `AuthAccount` entity is a plain struct without `EventVersion`.
- A migration folds existing `auth_account_events` into `auth_accounts` (backfilling
  any missing rows) and drops the `auth_account_events` table. The treatment of the
  `auth_accounts.version` column (dropped or retained with default) is decided in
  implementation and recorded at closeout.
- TRUNCATE targets in test_mode / e2e support no longer reference auth_account_events.
- `cargo test` (with `DATABASE_URL`) / clippy / fmt are green; e2e (compose) is green.
  The existing auth flow (Kratos login → Hydra OAuth2 → JWT →
  `resolve_auth_account_id` → account create/list) is preserved.

## Verification

- Concurrency test: parallel `find_or_create` with the same (host_id, client_id)
  returns one id and one row.
- Migration test: seed `auth_account_events` with rows missing from `auth_accounts`,
  run migrations, assert backfill completed and the events table is gone.
- Equivalence: login / account-creation flows covered by existing route tests and
  e2e (`server/tests/e2e_basic_flow.rs`, compose) behave identically.
- No remaining references: `auth_account_events`, `AuthAccountEventStore`,
  `AuthAccountCommandProcessor`, `UpdateAuthAccount`, `auth_account_applier`,
  `DependOnAuthAccountSignal` are absent from the tree (grep).
- `git diff --check` clean.

## Related Links

- ADR 0006: `intents/emumet/decisions/0006-architecture-realignment-transaction-projection.md`
  (決定8 / 決定9 / 決定10)
- Backlog: `intents/emumet/packets/backlog.md`
- Stage 1 PR #25: https://github.com/ShuttlePub/Emumet/pull/25
- Stage 2 PR #27: https://github.com/ShuttlePub/Emumet/pull/27
- Stage 3 PR #29: https://github.com/ShuttlePub/Emumet/pull/29
- Stage 4 PR #31: https://github.com/ShuttlePub/Emumet/pull/31
- Stage 5 PR #33: https://github.com/ShuttlePub/Emumet/pull/33

## Knowledge Maintenance

- Intent placement: `intents/emumet/decisions/0006-architecture-realignment-transaction-projection.md`
- ADR candidate: yes — record Stage 6 final values (CRUD port signature,
  find-or-create SQL shape, version column treatment, data migration procedure)
  in ADR 0006 decisions 8/9/10.
- Diagram candidate: none
- Docs update: none
- Closeout writeback expected: yes

## Guide Reachability

No role-facing surface is added. HTTP routes and the auth flow remain unchanged;
this slice changes internal persistence structure only.

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open all child PRs against `main` directly.
