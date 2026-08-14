# account-write-usecases: CreateAccount / UpdateAccountDetail / moderation を UoW に移行、SigningKey executor 受け取り化、Keto post-commit provisioning (ADR 0006 Stage 4)

## Goal

ADR 0006 (アーキテクチャ再配置) Stage 4。`CreateAccount` / `UpdateAccountDetail` /
moderation (suspend / unsuspend / ban / deactivate) のユースケースを
`TransactionManager::transaction()` ベースの Unit of Work (UoW) に移行する。
同時に `SigningKeyRepository::create` / `CreateSigningKeyUseCase` を executor
受け取りに変更し、`CreateAccount` 内で同一トランザクションを共有できるようにする。
Keto relation の書き込みは DB transaction 内から外し、commit 後の冪等
provisioning として再配置する (決定5)。さらに Stage 2 で導入済みの
`AggregateRepository<Account>` をユースケース層で本採用し、
`rehydrate_account()` ヘルパー経由の event store 直読みと
`AccountCommandProcessor` 内の `persist_and_transform` 直呼びを整理する。
main green を維持する。

## Why This Slice Exists Now

`CreateAccount` は現状4つの独立した書き込み (account event + projection、
profile event + projection、Keto relation HTTP、signing key) を auto-commit
接続で実行しており、DB 障害・Keto 障害・プロセスクラッシュのいずれかの
タイミングで中間状態が残る。これは ADR 0006 Context で指摘した
「現在進行形のデータ不整合リスク」の核心部分である。

`UpdateAccountDetail` のみが `get_transaction()` を使うが、低レベル API
直使いであり `TransactionManager` 規約を活用していない。moderation 系も同様に
auto-commit のままである。

Stage 2 までに `AggregateRepository<Account>` port と `Rehydrated<A>` は完成
したが、アプリケーション層では未だ `rehydrate_account()` ヘルパー (event store
直読み) を使い、`DependOnAccountRepository` を要求するユースケースが存在しない。
Stage 4 の UoW 移行とセットで repository の本採用を行うことで、
「Service は closure で原子範囲を宣言するだけ」という ADR 0006 決定2 の構造を
完成させる。

Keto は PostgreSQL と別の外部 HTTP サービスであり、DB rollback では取り消せない。
決定5 の通り、DB commit 後の冪等 provisioning として配置する。

## Current Observed State

- `CreateAccountUseCase` (`application/src/service/account/create.rs`) は auto-commit
  接続上で4系統の独立書き込みを実行: `account_command_processor().create`、
  `profile_command_processor().create`、`permission_writer().create_relation` (Keto HTTP)、
  `CreateSigningKeyUseCase`。現状アトミックでない。
- `UpdateAccountDetailUseCase` (`application/src/service/account_detail/update.rs`) のみ
  `get_transaction()` + `transaction.commit()` を使い、低レベル Transaction API を
  直接使用。他のユースケースは `connection()` のみ。
- moderation ユースケース (`application/src/service/account/moderation.rs`) は
  suspend/unsuspend/ban の3つ。deactivate (`application/src/service/account/deactivate.rs`)
  はコマンド + Keto relation 削除 (Owner/Editor/Signer) ×3。いずれも auto-commit。
- `unban` / `reactivate` は集約・イベント・ユースケース・エンドポイントのいずれにも
  存在しない。`AccountEvent` は Created/Updated/Deactivated/Suspended/Unsuspended/Banned
  のみ (`kernel/src/entity/account.rs`)。
- `TransactionManager` port (`kernel/src/database.rs`) と Postgres 実装
  (`driver/src/database/postgres.rs` 181行目) は Stage 1 で完成。ユースケース層での
  呼び出しはゼロ — テスト (`driver/src/database/postgres/transaction_manager_tests.rs`)
  と projection worker (`application/src/projection/account_projector.rs`) のみ。
- `AggregateRepository<Account>` / `DependOnAccountRepository`
  (`kernel/src/repository/aggregate.rs`) と Postgres 実装
  (`driver/src/database/postgres/account_repository.rs`) は Stage 2 で完成。だが
  `application/src` 内で `account_repository()` を使うユースケースはゼロ。全て
  `application/src/service/account/rehydrate.rs` の `rehydrate_account()` ヘルパー
  (event store 直読み) を経由。
- `AccountCommandProcessor` (`adapter/src/processor/account/command.rs`) も
  `account_event_store().persist_and_transform()` を直呼びしており、AggregateRepository
  を経由しない。
- `SigningKeyRepository` port (`kernel/src/entity/signing_key.rs`) / Postgres 実装
  (`driver/src/database/postgres/signing_key.rs`) は存在。`CreateSigningKeyUseCase`
  (`application/src/signing_key.rs`) は自前で `connection()` を取得して
  `SigningKeyRepository::create` を呼ぶ — `CreateAccount` 内で独立コネクションになる。
- `KetoClient` (`driver/src/keto.rs`) はすでに driver crate に所在し
  PermissionChecker/PermissionWriter を実装。生成は `server/src/handler.rs` の
  `init_with_urls` (KETO_READ_URL / KETO_WRITE_URL) で行われ、AppModule/Handler が
  委譲。DB transaction 内からは呼ばないが、現状 `CreateAccount` 内では transaction
  概念がないため Keto 書き込みがコマンド処理と同一「処理」に混在している。
- `Executor` / `Executor::commit` no-op は Stage 1 (PR #25) で撤去済み。
  `kernel/src` に `Executor` の痕跡はない。
- `Block` / `Unblock` (`application/src/service/block.rs`) はイベントソースではなく
  `BlockRepository` テーブル駆動。ActivityPub 配送・outbox 化は Stage 5 のスコープ。

## Accepted Baseline You May Assume

- ADR 0006 全体 (決定1: 層の定義と依存方向 / adapter 解体、決定2: Transaction は
  DataStore 完結 / Service は closure で宣言 / UoW 対象5ユースケース、決定3:
  4系統の port 文法と `AggregateRepository<A>` / `ExpectedVersion`、決定5:
  外部プロビジョニング (Keto) は post-commit、決定7: DI ケーキパターン維持、
  決定8: AuthAccount ES→CRUD、決定9: ドメイン/projection 分離、決定10:
  命名の正規化)
- ADR 0006 への writeback 済み設計入力:
  - Stage 1 review より: `TransactionManager::transaction()` の nested 呼び出しは
    savepoint ではなく別 pool 接続の独立 transaction になり自己デッドロックしうる。
    top-level ユースケース境界でのみ呼ぶ。
  - Stage 2 review より: UoW 内で同一集約に連続 save する場合、直前の
    `EventEnvelope.version` を次のコマンドの `ExpectedVersion::At(v)` に連鎈させる。
    また legacy append SQL の CAS (`NOT EXISTS` / `MAX(version)=v`) は同時書き込み下で
    両方の transaction を通しうる — 楽観排他に依存する前に UNIQUE 制約・advisory
    lock 等の原子的 CAS への強化を検証。
  - Stage 2/3 review より: `Rehydrated::from_events` は入力列の最後の envelope を
    境界 version とする。グローバル tailing (seq 順) と per-stream rehydration
    (version 順) の順序規則を分離。
- Stage 1 / Stage 2 / Stage 3 完了済み (PR #25 / PR #27 / PR #29 マージ済み)
- rust-toolchain は 1.97.0
- DB テストは `#[test_with::env(DATABASE_URL)]` で compose の Postgres 16 相手に実行
- 移動と挙動変更は別 commit に分離する (ADR §10 実施ルール)。parallel change
  (新しい名前で書き始めてから旧名を消す) を徹底し、main green を維持する

## Target Repo / Path / Part

Repository: `ShuttlePub/Emumet`

Target paths: `application/src/service/account/create.rs, application/src/service/account/update.rs, application/src/service/account/moderation.rs, application/src/service/account/deactivate.rs, application/src/service/account_detail/update.rs, application/src/service/account/rehydrate.rs, application/src/signing_key.rs, application/src/service/block.rs, adapter/src/processor/account/command.rs, kernel/src/database.rs, kernel/src/repository/aggregate.rs, driver/src/database/postgres.rs, driver/src/database/postgres/account_repository.rs, driver/src/database/postgres/signing_key.rs, driver/src/keto.rs, server/src/handler.rs, server/src/route/account/admin.rs, server/src/route/account/client.rs`

Target part: CreateAccount / UpdateAccountDetail / moderation (suspend/unsuspend/ban/deactivate) の UoW 化、SigningKey repository/create への executor 受け渡し、Keto provisioning を DB commit 後の冪等処理へ再配置、AggregateRepository<Account> をユースケース層で本採用

## In Scope

- `CreateAccount` / `UpdateAccountDetail` / moderation 4種を `TransactionManager::transaction()` ベースの UoW に移行
- `DependOnTransactionManager` 的な注入 port の追加 (kernel) と AppModule/Handler への実装登録
- ユースケース層で `DependOnAccountRepository` + `account_repository().load/save` を使用
- `AccountCommandProcessor` の `persist_and_transform` 直呼びを `AggregateRepository::save(CommandEnvelope)` 経由に変更
- `SigningKeyRepository::create` / `CreateSigningKeyUseCase` を executor 受け取りに変更
- Keto relation の create/delete を DB tx 内から外し、post-commit provisioning として配置
- UoW 移行前後の等価性テストと rollback integration テスト
- ADR 0006 決定2/3/5 への Stage 4 確定値 writeback

## Out Of Scope

- `unban` / `reactivate` の新規実装 (現状存在しない。必要なら別 issue / Stage 7以降)
- `Block` / `Inbox Follow` / `Inbox Block` の tx + 配送 outbox 化 (Stage 5)
- `Mute` / `Accept` / `Undo Follow` / `Undo Block` の冪等 repo 操作化 (Stage 5)
- `AuthAccount` ES→CRUD 移行 (Stage 6)
- `Profile` / `Metadata` の ES repository/projector パターン移行 (Stage 7)
- route facade newtype 化 / adapter クレート削除 (Stage 8)

## Standalone Child Issue Contract

This issue asks the child implementation repo to migrate `CreateAccount`,
`UpdateAccountDetail`, and the four moderation use cases (suspend / unsuspend / ban /
deactivate) to `TransactionManager::transaction()`-based Units of Work; switch
`SigningKeyRepository::create` and `CreateSigningKeyUseCase` to accept an executor so
`CreateAccount` can share one DB transaction; move Keto relation writes out of the DB
transaction into post-commit idempotent provisioning; and adopt `AggregateRepository<Account>`
from the use-case layer (replacing the `rehydrate_account()` helper and the processor's
direct `persist_and_transform` call). Tests must stay green and main must remain green.

## Acceptance Criteria

- Pure rename commit separates any remaining naming cleanup from behavior changes.
- `CreateAccountUseCase` runs inside `TransactionManager::transaction()`; the four writes
  (account event+projection, profile event+projection, Keto relation, signing key) share
  the same DB transaction. No Keto HTTP call happens before commit.
- `UpdateAccountDetailUseCase` is migrated to `TransactionManager::transaction()` and stops
  using low-level `get_transaction()` / `transaction.commit()` directly.
- Moderation use cases (suspend/unsuspend/ban/deactivate) run inside
  `TransactionManager::transaction()`. Deactivate's Keto relation removals are post-commit
  provisioning, not inside the DB tx.
- Use cases use `DependOnAccountRepository` + `account_repository().load(id)` /
  `save(CommandEnvelope)` instead of `rehydrate_account()`. The helper is removed or reduced
  to test-only.
- `AccountCommandProcessor` stops calling `persist_and_transform` directly and uses
  `AggregateRepository<Account>::save(CommandEnvelope)`.
- `SigningKeyRepository::create` and `CreateSigningKeyUseCase` accept an executor argument
  and are called from inside the UoW closure.
- Keto provisioning is placed after DB commit in a driver-layer idempotent provisioning slot
  or callback. Failure is retryable; no saga guarantees in this slice.
- If `unban` / `reactivate` are not implemented, the PR description explicitly states they
  remain unimplemented and are deferred.
- When saving the same aggregate multiple times inside a UoW, the previous `EventEnvelope.version`
  is chained as the next `CommandEnvelope.expected_version` (`ExpectedVersion::At(v)`).
- Single-write use cases (Mute, Accept, Undo Follow, Undo Block) are left untouched.
- `cargo test` (with `DATABASE_URL`) / `clippy` / `fmt` green; e2e (compose) green.

## Verification

- Characterization or equivalence tests showing pre/post UoW migration behavior is identical.
- Integration test that fails inside a UoW and asserts rollback restores `accounts`,
  `account_events`, `profiles`, `signing_keys`, `auth_accounts`, and projection tables.
- Keto mock or e2e test asserting Keto writes occur after DB commit.
- `git diff --check` clean.

## Related Links

- ADR 0006: `intents/emumet/decisions/0006-architecture-realignment-transaction-projection.md`
- Backlog: `intents/emumet/packets/backlog.md`
- Stage 1 PR #25: https://github.com/ShuttlePub/Emumet/pull/25
- Stage 2 PR #27: https://github.com/ShuttlePub/Emumet/pull/27
- Stage 3 PR #29: https://github.com/ShuttlePub/Emumet/pull/29

## Knowledge Maintenance

- Intent placement: `intents/emumet/decisions/0006-architecture-realignment-transaction-projection.md`
- ADR candidate: yes — record Stage 4 final values (UoW target list, SigningKey executor passing shape, Keto post-commit placement, `AggregateRepository` adoption) in ADR 0006 decisions 2/3/5.
- Diagram candidate: none
- Docs update: Emumet `AGENTS.md` Architecture section deferred until ADR 0006 migration completes (ADR Links).
- Closeout writeback expected: yes

## Guide Reachability

No role-facing surface is added. This slice changes internal use-case / repository /
provisioning structure only; HTTP routes remain the same.

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open all child PRs against `main` directly.
