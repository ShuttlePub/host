# crud-ap-transactions Implementation Packet

## Goal

ADR 0006 Stage 5. `BlockAccountUseCase` / `UnblockAccountUseCase`、inbox `Follow`
ハンドラ、inbox `Block` / `Undo(Block)` ハンドラを
`TransactionManager::transaction()` ベースの Unit of Work (UoW) に移行し、
ActivityPub 配送を outbox パターンに移す。

同時に `Mute` / `Accept` / `Undo Follow` / `Undo Block` は冪等な repository 操作
(`insert_if_absent` / `delete_if_exists` / `approve_if_pending` 等) に置換し、
UoW を不要にする。

## Why

Stage 4 までで Account 系の write use case は UoW 化された。しかし
Block / Inbox Follow / Inbox Block は引き続き auto-commit 接続上で local state 変更、
AP delivery、outbox 記録を混在させており、delivery 失敗やプロセスクラッシュで
DB 状態と AP 履歴が不一致になりうる。

mute / accept / undo は本質的に単一 write なので UoW ほどのコストは不要だが、
重複・不存在・順不同到達を安全に処理するためには idempotent な repository 操作が必要である。

## 設計判断 (host 側で確定済み)

1. **UoW 対象**
   - `BlockAccountUseCase` / `UnblockAccountUseCase`
   - inbox `Follow` ハンドラ (`handle_follow_activity`)
   - inbox `Block` ハンドラ (`handle_block_activity`)
   - inbox `Undo(Block)` ハンドラ (`handle_undo_block_activity`)
   これらは local DB write が複数 (relation + follow 解除/復元 + outbox insert)
   かつ AP delivery を伴う。

2. **冪等 repo 操作対象**
   - `MuteAccountUseCase` / `UnmuteAccountUseCase`
   - inbox `Accept` ハンドラ (`handle_accept_activity`)
   - inbox `Undo(Follow)` ハンドラ (`handle_undo_follow`)
   これらは単一 write で、重複 activity や再試行を許容すべき。

3. **AP 配送 outbox 化**
   DB tx 内で outbox テーブルに activity を書き込み、commit 成功後に delivery HTTP を行う。
   delivery 失敗時は outbox レコードを再試行可能な状態に保つ。
   最小構成は post-commit 即時 delivery + 失敗時保留; worker 化は optional。

4. **TransactionManager 注入**
   Stage 4 と同じ `DependOnTransactionManager` trait 経由で `TransactionManager` を注入。
   Service は `transaction_manager().transaction(|conn| async move { ... })` で UoW を宣言。

5. **Repository 冪等化**
   `insert_if_absent`、`delete_if_exists`、`approve_follow_if_pending` 等を kernel port に追加し、
   driver で UNIQUE/部分 index + `ON CONFLICT` または条件付き更新で実装。
   既存 `create`/`delete` も維持し parallel change。

6. **Out of scope**
   route facade newtype 化 (Stage 8)、AuthAccount CRUD (Stage 6)、
   Profile/Metadata ES migration (Stage 7)、adapter crate removal (Stage 8)。

## Scope

- `BlockAccountUseCase` / `UnblockAccountUseCase` の UoW 移行 + outbox 化
- inbox `Follow` / `Block` / `Undo(Block)` ハンドラの UoW 移行 + Accept/outbox 化
- `Mute` / `Accept` / `Undo Follow` / `Undo Block` の冪等 repo 操作化
- delivery outbox テーブル/カラム追加または `ap_delivery_queue` テーブル新設
- `TransactionManager` の注入配線 (AppModule/Handler)
- 関連テストの追加・修正

## Out of scope

- outbound `SendFollow` / `SendUndoFollow` の tx + outbox 化
  (既存 `outbound_follow.rs` / `outbound_unfollow.rs` は本 Stage では変更しない。
  必要なら別 issue)
- Mute の連合通知 (非連合のまま)
- Block 成立時の `Reject(Follow)` 送信
- 配送 worker の long-running process 化
  (post-commit 即時 delivery を baseline とし、worker 化は optional)
- route facade newtype / adapter removal / Profile ES migration

## Verification

- UoW 移行前後の等価性テスト
- rollback テスト: tx 内で失敗させ、block/follow/mute/outbox/projection テーブルが元に戻る
- delivery outbox テスト: outbox insert が tx 内、delivery HTTP が commit 後に呼ばれる
- 冪等 repo 操作テスト: 重複 Mute/Accept/Undo/Undo Block が idempotent
- `cargo test` (DATABASE_URL あり) / clippy / fmt / e2e green

## Knowledge Maintenance (G461, optional)

- Intent placement: `intents/emumet/decisions/0006-architecture-realignment-transaction-projection.md`
- ADR candidate: yes — Stage 5 確定値を決定2/3/4 に writeback
- Diagram candidate: none
- Docs update: none
- Closeout learning: delivery outbox pattern, idempotent repo signatures, worker vs immediate delivery 判断
- Guide reachability (G645): `no_role_facing_surface: true`

`improve` (G456 / G460) is the later safety net; packet-time maintenance is the normal path.
