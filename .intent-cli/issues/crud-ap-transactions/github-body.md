## Goal

ADR 0006 Stage 5. `BlockAccountUseCase` / `UnblockAccountUseCase`、inbox `Follow`
ハンドラ、inbox `Block` / `Undo(Block)` ハンドラを
`TransactionManager::transaction()` ベースの Unit of Work (UoW) に移行し、
ActivityPub 配送を outbox パターンに移す。

同時に `Mute` / `Accept` / `Undo Follow` / `Undo Block` は冪等な repository 操作
(`insert_if_absent` / `delete_if_exists` / `approve_if_pending` 等) に置換し、
UoW を不要にする。

## Why This Slice Exists Now

Stage 4 までで Account 系の write use case は UoW 化された。しかし
Block / Inbox Follow / Inbox Block は引き続き auto-commit 接続上で local state 変更、
AP delivery、outbox 記録を混在させており、delivery 失敗やプロセスクラッシュで
DB 状態と AP 履歴が不一致になりうる。

mute / accept / undo は本質的に単一 write なので UoW ほどのコストは不要だが、
重複・不存在・順不同到達を安全に処理するためには idempotent な repository 操作が必要である。

## Current Observed State

- `BlockAccountUseCase` / `UnblockAccountUseCase` (`application/src/service/block.rs`) は auto-commit 接続を取得し、Block 作成/削除、双方向 follow 解除/復元、remote 宛 Block/Undo(Block) の配送、outbox 記録を順次実行。delivery は DB write より先に行われ、失敗時に local state が不整合になりうる。
- `MuteAccountUseCase` / `UnmuteAccountUseCase` (`application/src/service/mute.rs`) は auto-commit 接続で `mutes` テーブルへの insert/delete を行う。重複時はアプリ層で `Rejected` を返している (DB の partial unique index あり)。
- Inbox Follow ハンドラ (`application/src/service/activitypub/inbox/handlers.rs:handle_follow_activity`) は remote_account upsert、follow 作成 (approved)、Accept アクティビティの配送、outbox 記録を auto-commit で実行。
- Inbox Block / Undo(Block) ハンドラ (`application/src/service/activitypub/inbox/handlers.rs`) は remote_account upsert、block 作成/削除、双方向 follow 解除を auto-commit で実行。
- Inbox Accept ハンドラ (`application/src/service/activitypub/inbox/handlers.rs:handle_accept_activity`) は auto-commit で既存 follow の `approved_at` 更新を行う。
- `outbox_activities` テーブルは `migrations/20260621000004_add_outbox_activities.sql` で定義済み。現状は outbox collection API 用の記録兼 delivery 後の履歴。delivery 専用 queue / worker は未整備。
- `TransactionManager` port (`kernel/src/database.rs`) と `PostgresTransactionManager` は Stage 1 で導入済み。Stage 4 で `CreateAccount` / `UpdateAccountDetail` / moderation で本採用済み。
- `BlockRepository` / `FollowRepository` / `MuteRepository` / `OutboxActivityRepository` は kernel port + Postgres 実装。insert は unique 制約違反を `Rejected` で返すが、idempotent な `insert_if_absent` / `delete_if_exists` 等のインターフェースはない。

## Accepted Baseline You May Assume

- ADR 0006 全体 (決定1: 層の定義と adapter 解体、決定2: Transaction DataStore 完結 / Service は closure で宣言 / UoW 対象5ユースケース、決定3: 4系統の port 文法、決定4: projection 通知は transactional log tailing / AP 配送 outbox は別物、決定5: 外部プロビジョニング post-commit、決定7: DI ケーキパターン)
- Stage 1 / Stage 4 完了済み (PR #25 / PR #31 マージ済み)。`TransactionManager` の Box::pin closure signature と `DependOnTransactionManager` 注入形状は確定。
- `outbox_activities` テーブルは AP collection 用に存在。delivery 状態を持たせるためのカラム追加または新テーブル作成は本 Stage の In Scope。
- rust-toolchain は 1.97.0。DB テストは `#[test_with::env(DATABASE_URL)]` で Postgres 16 相手に実行。
- 移行と挙動変更は別 commit に分離する (ADR §10)。parallel change を徹底し main green を維持する。

## Target Repo / Path / Part

Repository: `ShuttlePub/Emumet`

Target paths: `application/src/service/block.rs, application/src/service/mute.rs, application/src/service/activitypub/outbound_block.rs, application/src/service/activitypub/outbound_follow.rs, application/src/service/activitypub/outbound_unfollow.rs, application/src/service/activitypub/inbox/handlers.rs, application/src/service/activitypub/inbox/mod.rs, application/src/service/activitypub/outbox.rs, application/src/service/activitypub/delivery.rs, kernel/src/database.rs, kernel/src/repository/block.rs, kernel/src/repository/follow.rs, kernel/src/repository/mute.rs, kernel/src/repository/outbox_activity.rs, driver/src/database/postgres/block.rs, driver/src/database/postgres/follow.rs, driver/src/database/postgres/mute.rs, driver/src/database/postgres/outbox_activity.rs, server/src/route/account/block_mute.rs, server/src/route/account/follow.rs, server/src/route/activitypub/inbox.rs`

Target part: Block / Inbox Follow / Inbox Block の UoW 化 + AP 配送 outbox 化、Mute / Accept / Undo Follow / Undo Block の冪等 repo 操作化

## In Scope

- `BlockAccountUseCase` / `UnblockAccountUseCase` を `TransactionManager::transaction()` ベースの UoW に移行。DB 書き込み (block 作成/削除、follow 解除/復元、outbox 記録) を同一トランザクションにまとめ、AP delivery HTTP は commit 成功後に実行される。
- Inbox Follow / Inbox Block / Undo(Block) ハンドラを UoW 化。remote_account upsert、follow/block 作成・削除、follow 解除、Accept/outbox 記録を tx 内にまとめ、delivery は commit 後。
- `Mute` / `Accept` / `Undo Follow` / `Undo Block` を冪等 repository 操作に置換。重複・不存在・未承認を DB 制約 + 戻り値で解釈し、アプリ層での事前 `find` + `Rejected` 依存を減らす (`insert_if_absent`、`approve_follow_if_pending`、`delete_follow_if_exists`、`delete_block_if_exists`、`delete_mute_if_exists` 等)。
- 冪等 repo 操作は UoW を必要としない。必要なら `&mut Connection` executor を引き渡し、単一 auto-commit 接続で実行する。
- AP 配送 outbox 化: delivery 失敗時に再試行できる構造を導入。最小構成は outbox テーブルへの `delivered_at`/`attempted_at`/`error` 列追加、または `ap_delivery_queue` テーブル新設 + post-commit 即時 delivery。worker 化は optional とし、post-commit delivery と失敗時の再試行可能性を要求。
- outbox 記録と AP 配送は projection 通知 outbox (ADR 決定4) と別物であることを明示。`outbox_activities` は AP collection 用テーブルであり、必要に応じて delivery state 列を追加する。
- 配線層 (`server/src/handler.rs`, `server/src/route/**`) で `DependOnTransactionManager` を AppModule 経由で受け取れるようにする。route facade newtype 化は Stage 8 のスコープ。
- 関連するユニットテスト / integration テストの追加・修正。

## Out Of Scope

- outbound `SendFollow` / `SendUndoFollow` の tx + outbox 化 (既存 `outbound_follow.rs` / `outbound_unfollow.rs` は本 Stage では変更しない; 必要なら別 issue)。
- Mute の連合通知 (非連合のまま)。
- Block 成立時の `Reject(Follow)` 送信。
- 配送 worker の long-running process 化 (post-commit 即時 deliveryを baseline とし、worker 化は optional)。
- route facade newtype 化 / adapter crate 削除 / Profile・Metadata ES migration / AuthAccount CRUD。

## Standalone Child Issue Contract

This issue asks the child implementation repo to migrate `BlockAccountUseCase` /
`UnblockAccountUseCase`, the inbox `Follow` handler, and the inbox `Block` /
`Undo(Block)` handlers to `TransactionManager::transaction()`-based Units of Work;
move ActivityPub delivery out of the DB transaction by writing to an outbox table
inside the tx and delivering after commit; and replace `Mute`, inbox `Accept`,
inbox `Undo(Follow)`, and inbox `Undo(Block)` with idempotent repository operations
that handle duplicates / missing rows / out-of-order delivery via DB constraints
and return values rather than application-level checks.

Tests must stay green and `main` must remain green.

## Acceptance Criteria

- `BlockAccountUseCase` / `UnblockAccountUseCase` run inside `TransactionManager::transaction()`; local DB writes and outbox insert share the same transaction. AP delivery HTTP calls happen only after commit.
- Inbox `Follow` / `Block` / `Undo(Block)` handlers run inside `TransactionManager::transaction()`; local writes and outbox insert are atomic. AP delivery happens after commit.
- `Mute` / `Accept` / `Undo Follow` / `Undo Block` use idempotent repository operations (e.g., `insert_if_absent`, `approve_follow_if_pending`, `delete_if_exists`). Duplicate or missing rows do not produce `Rejected` unless the contract explicitly requires it.
- Idempotent repository operations do not require a UoW; they accept an executor and run on a single connection.
- A delivery outbox structure exists so that failed AP deliveries can be retried (post-commit immediate delivery with retryable failure state is the minimum).
- `DependOnTransactionManager` is wired through the AppModule so that UoW use cases can receive it.
- `cargo test` (with `DATABASE_URL`) / clippy / fmt are green; e2e (compose) is green.
- Existing behavior (bidirectional follow removal on Block, duplicate rejection semantics for Block/Mute/Follow, no federation for Mute) is preserved.

## Verification

- Characterization or equivalence tests showing pre/post migration behavior is identical for Block / Mute / Inbox Follow / Inbox Block.
- Integration test that fails inside a UoW and asserts rollback restores `blocks`, `follows`, `mutes`, `outbox_activities`, and projection tables.
- Tests showing AP delivery occurs after DB commit (mock signer/delivery or e2e).
- Idempotency tests for duplicate `Mute`/`Accept`/`Undo Follow`/`Undo Block`.
- `git diff --check` clean.

## Related Links

- ADR 0006: `intents/emumet/decisions/0006-architecture-realignment-transaction-projection.md`
- Backlog: `intents/emumet/packets/backlog.md`
- Stage 1 PR #25: https://github.com/ShuttlePub/Emumet/pull/25
- Stage 4 PR #31: https://github.com/ShuttlePub/Emumet/pull/31

## Knowledge Maintenance

- Intent placement: `intents/emumet/decisions/0006-architecture-realignment-transaction-projection.md`
- ADR candidate: yes — record Stage 5 final values (UoW target list, idempotent repo operation list, delivery outbox pattern) in ADR 0006 decisions 2/3/4.
- Diagram candidate: none
- Docs update: none
- Closeout writeback expected: yes

## Guide Reachability

No role-facing surface is added. HTTP routes remain unchanged; this slice changes internal use-case / repository / delivery structure only.

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open all child PRs against `main` directly.
