## Goal

ADR 0006 Stage 9 (Stage 5 re-apply / recovery)。`BlockAccountUseCase` /
`UnblockAccountUseCase`、inbox `Follow` ハンドラ、inbox `Block` / `Undo(Block)`
ハンドラを `TransactionManager::transaction()` ベースの Unit of Work (UoW) に
移行し、ActivityPub 配送を outbox パターンに移す。

同時に `Mute` / `Accept` / `Undo Follow` / `Undo Block` は冪等な repository 操作
(`insert_if_absent` / `delete_if_exists` / `approve_follow_if_pending` 等) に
置換し、UoW を不要にする。

## Why This Slice Exists Now

**これは recovery issue である。** Stage 5 (issue #32 / PR #33) は draft PR のまま
closeout が記録され、コードは一度も main にマージされなかった。PR #33 は
Stage 6-8 のマージにより現行 main と 8 箇所コンフリクトするため superseded として
close 済み (2026-08-16)。本 issue は Stage 5 の intent を **現行 main 上で再適用**
する。

現行 main の問題: Block / Inbox Follow / Inbox Block は auto-commit 接続上で
local state 変更・AP delivery・outbox 記録を混在させており、`block.rs` では
delivery HTTP が DB write **より先** に実行される。delivery 失敗やプロセス
クラッシュで DB 状態と AP 履歴が不一致になりうる。

## Current Observed State

- `BlockAccountUseCase` / `UnblockAccountUseCase` (`application/src/service/block.rs`) は auto-commit 接続を取得し、remote 宛 Block/Undo(Block) の delivery HTTP を DB write より先に実行し、その後 block 作成/削除・双方向 follow 解除・outbox 記録を順次実行する。
- Inbox Follow ハンドラ (`application/src/service/activitypub/inbox/handlers.rs:handle_follow_activity`) は remote_account upsert、follow 作成 (approved)、Accept 配送、outbox 記録を auto-commit で実行。delivery 失敗は warn ログのみ。
- Inbox Block / Undo(Block) / Accept / Undo(Follow) ハンドラは read-check-then-write パターンで auto-commit 実行。冪等性はアプリ層の事前 find 依存。
- `MuteAccountUseCase` / `UnmuteAccountUseCase` (`application/src/service/mute.rs`) は auto-commit 接続で `mutes` テーブルへの insert/delete。重複時はアプリ層で `Rejected`。
- `outbox_activities` テーブルは `migrations/20260621000004_add_outbox_activities.sql` で定義済み。delivery 状態カラム (`delivered_at` / `attempted_at` / `error`) は存在しない (Stage 5 のマイグレーションは main 未適用)。
- `BlockRepository` / `FollowRepository` / `MuteRepository` / `OutboxActivityRepository` に `insert_if_absent` / `delete_if_exists` / `approve_follow_if_pending` 等の冪等インターフェースは存在しない。

## Accepted Baseline You May Assume

- ADR 0006 全体 (決定1-9)。Stage 1 / 3 / 4 / 6 / 7 / 8 は main にマージ済み (PR #25 / #29 / #31 / #35 / #38 / #40)。
- `TransactionManager` port (`kernel/src/database.rs`) + `DependOnTransactionManager` 注入形状は Stage 4/6 で確立済み。Service は `transaction_manager().transaction(|conn| async move { ... })` で UoW を宣言する。
- Stage 8 で adapter crate は解体済み。配線は `server/src/route/**` の route facade + 集約済み DI (AppModule) に従う。
- ADR 0006 の「Stage 5 確定」セクションの設計値 (UoW 対象・冪等 repo 操作 signature・delivery outbox パターン) は本 issue の **設計入力**。ただしコード未着地の closeout から記録されたものであり、Stage 6-8 で ground が変わった部分は現行構造に合わせて再設計してよい (差異は PR で説明すること)。
- 参考資料: closed PR #33 の branch `claude/crud-ap-transactions-stage5` に旧実装 diff が残る。**cherry-pick / rebase はしない** (現行 main と 8 箇所コンフリクト)。設計意図の参照のみ。
- rust-toolchain は 1.97.0。DB テストは `#[test_with::env(DATABASE_URL)]` で Postgres 16 相手に実行。
- 移行と挙動変更は別 commit に分離する (ADR §10)。parallel change を徹底し main green を維持する。

## Target Repo / Path / Part

Repository: `ShuttlePub/Emumet`

Target paths: `application/src/service/block.rs, application/src/service/mute.rs, application/src/service/activitypub/outbound_block.rs, application/src/service/activitypub/inbox/handlers.rs, application/src/service/activitypub/inbox/mod.rs, application/src/service/activitypub/outbox.rs, application/src/service/activitypub/delivery.rs, kernel/src/database.rs, kernel/src/repository/block.rs, kernel/src/repository/follow.rs, kernel/src/repository/mute.rs, kernel/src/repository/outbox_activity.rs, driver/src/database/postgres/block.rs, driver/src/database/postgres/follow.rs, driver/src/database/postgres/mute.rs, driver/src/database/postgres/outbox_activity.rs, server/src/route/account, server/src/route/activitypub, migrations`

Target part: Block / Inbox Follow / Inbox Block の UoW 化 + AP 配送 outbox 化、Mute / Accept / Undo Follow / Undo Block の冪等 repo 操作化 (Stage 5 intent の現行 main への再適用)

## In Scope

- `BlockAccountUseCase` / `UnblockAccountUseCase` を `TransactionManager::transaction()` ベースの UoW に移行。DB 書き込み (block 作成/削除、follow 解除、outbox 記録) を同一トランザクションにまとめ、AP delivery HTTP は commit 成功後にのみ実行する (現行の delivery-first 順序を解消)。
- Inbox Follow / Inbox Block / Undo(Block) ハンドラを UoW 化。remote_account upsert、follow/block 作成・削除、follow 解除、Accept/outbox 記録を tx 内にまとめ、delivery は commit 後。
- `Mute` / `Accept` / `Undo Follow` / `Undo Block` を冪等 repository 操作に置換 (`insert_if_absent`、`approve_follow_if_pending`、`delete_if_exists` 等)。重複・不存在・順不同到達を DB 制約 + 戻り値で解釈し、アプリ層の事前 `find` + `Rejected` 依存を減らす。
- 冪等 repo 操作は UoW を必要としない。`&mut Connection` executor を引き渡し、単一接続で実行する。
- `outbox_activities` テーブルに delivery 状態カラム (`delivered_at` / `attempted_at` / `error`) を追加するマイグレーション。`OutboxActivityRepository.create` は発行した `outbox_id` を返し、`pending_deliveries` / `mark_delivered` / `mark_attempted` で delivery 状態を管理。post-commit 即時 delivery + 失敗時の再試行可能状態を実現 (worker 化は optional)。
- `DependOnTransactionManager` の配線 (現行 AppModule / route facade 構造に従う)。
- 関連するユニットテスト / integration テストの追加・修正。

## Out Of Scope

- outbound `SendFollow` / `SendUndoFollow` の tx + outbox 化 (既存 `outbound_follow.rs` / `outbound_unfollow.rs` は変更しない; 必要なら別 issue)。
- Mute の連合通知 (非連合のまま)。
- Block 成立時の `Reject(Follow)` 送信。
- 配送 worker の long-running process 化。
- Stage 6/7/8 で完了済みの領域 (AuthAccount CRUD / Profile・Metadata ES / route facade) への手入れ。
- host 側 ADR の修正・writeback (host が実施する。child 側スコープ外)。

## Standalone Child Issue Contract

This issue asks the child implementation repo to re-apply ADR 0006 Stage 5's intent on
current main: migrate `BlockAccountUseCase` / `UnblockAccountUseCase`, the inbox
`Follow` handler, and the inbox `Block` / `Undo(Block)` handlers to
`TransactionManager::transaction()`-based Units of Work; move ActivityPub delivery out
of the DB transaction by writing to the outbox table inside the tx and delivering after
commit (with retryable failure state); and replace `Mute`, inbox `Accept`, inbox
`Undo(Follow)`, and inbox `Undo(Block)` with idempotent repository operations that
handle duplicates / missing rows / out-of-order delivery via DB constraints and return
values rather than application-level checks.

The previous attempt (PR #33) was closed unmerged; implement against current main's
architecture (route facades, consolidated DI, ES Profile/Metadata), using the old
branch only as a design reference.

Tests must stay green and `main` must remain green.

## Acceptance Criteria

- `BlockAccountUseCase` / `UnblockAccountUseCase` run inside `TransactionManager::transaction()`; local DB writes and outbox insert share the same transaction. AP delivery HTTP calls happen only after commit (the current delivery-before-write ordering is eliminated).
- Inbox `Follow` / `Block` / `Undo(Block)` handlers run inside `TransactionManager::transaction()`; local writes and outbox insert are atomic. AP delivery happens after commit.
- `Mute` / `Accept` / Undo Follow / Undo Block use idempotent repository operations (e.g., `insert_if_absent`, `approve_follow_if_pending`, `delete_if_exists`). Duplicate or missing rows do not produce `Rejected` unless the contract explicitly requires it.
- Idempotent repository operations do not require a UoW; they accept an executor and run on a single connection.
- `outbox_activities` gains delivery state columns (`delivered_at` / `attempted_at` / `error`) via a new migration; `OutboxActivityRepository.create` returns the issued id and `pending_deliveries` / `mark_delivered` / `mark_attempted` manage delivery state. Post-commit immediate delivery with retryable failure state is the minimum.
- AP delivery outbox remains separate from the projection notification outbox (ADR decision 4); they are not unified.
- `DependOnTransactionManager` reaches the target use cases / inbox handlers through the current DI structure (route facades / AppModule).
- `cargo fmt --check` / `cargo check --workspace` / `cargo clippy --workspace -- -D warnings` / `cargo test --workspace` (with `DATABASE_URL`) are green; e2e (compose) is green.
- Existing behavior (bidirectional follow removal on Block, no federation for Mute) is preserved.

## Verification

- Characterization or equivalence tests showing pre/post migration behavior is identical for Block / Mute / Inbox Follow / Inbox Block.
- Integration test that fails inside a UoW and asserts rollback restores `blocks`, `follows`, `mutes`, `outbox_activities`, and projection tables.
- Tests showing AP delivery occurs after DB commit, and failed delivery leaves a retryable outbox record (`mark_attempted` + `error`).
- Idempotency tests for duplicate `Mute` / `Accept` / Undo Follow / Undo Block.
- `git diff --check` clean.

## Related Links

- ADR 0006: `intents/emumet/decisions/0006-architecture-realignment-transaction-projection.md` (host repo)
- Backlog: `intents/emumet/packets/backlog.md` (host repo)
- Superseded: issue #32 / PR #33 (closed unmerged; branch `claude/crud-ap-transactions-stage5` retained as design reference)
- Stage 4 PR #31 (UoW 注入形状の先例): https://github.com/ShuttlePub/Emumet/pull/31
- Stage 8 PR #40 (route facade / DI 集約の現行構造): https://github.com/ShuttlePub/Emumet/pull/40

## Knowledge Maintenance

- Intent placement: `intents/emumet/decisions/0006-architecture-realignment-transaction-projection.md`
- ADR candidate: host-side (Stage 5 確定セクションの根拠表記修正は実施済み。Stage 9 確定値の追記は closeout 時に host が実施)。child PR への `intents/**` 変更は不要
- Diagram candidate: none
- Docs update: none
- Closeout writeback expected: yes (host-side)

## Guide Reachability (G645)

No role-facing surface is added. HTTP routes remain unchanged; this slice changes internal use-case / repository / delivery structure only.

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open all child PRs against `main` directly.
