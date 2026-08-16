# crud-ap-transactions-reapply Implementation Packet

## Goal

ADR 0006 Stage 9 (Stage 5 re-apply)。`BlockAccountUseCase` /
`UnblockAccountUseCase`、inbox `Follow` ハンドラ、inbox `Block` / `Undo(Block)`
ハンドラを `TransactionManager::transaction()` ベースの Unit of Work (UoW) に
移行し、ActivityPub 配送を outbox パターンに移す。

同時に `Mute` / `Accept` / `Undo Follow` / `Undo Block` は冪等な repository 操作
(`insert_if_absent` / `delete_if_exists` / `approve_follow_if_pending` 等) に
置換し、UoW を不要にする。

## Why

**これは recovery packet である。** Stage 5 (issue #32 / PR #33) は closeout が
draft PR のまま記録され (host loop notes の既知の落とし穴)、コードは一度も main に
マージされなかった。issue #32 は closed、queue 上は completed だが、main には
Stage 5 の成果物 (UoW 化・配送 outbox 化・冪等 repo 操作) が一切存在しない。
その間に Stage 6 (AuthAccount CRUD) / Stage 7 (Profile/Metadata ES) /
Stage 8 (adapter 解体 + route facade) がマージされ、PR #33 の diff は現行 main と
8 箇所コンフリクトするため、PR #33 は superseded として close 済み。

本 Stage は Stage 5 の **intent を現行 main 上で再適用** する。設計の確定値は
ADR 0006 の「Stage 5 確定」セクションに記録済み (host 側で根拠表記を修正済み。
コード未着地の closeout から記録されたものであり、本 Stage の **設計入力** として
扱う)。

現行 main の問題は Stage 5 と同じ: Block / Inbox Follow / Inbox Block は
auto-commit 接続上で local state 変更・AP delivery・outbox 記録を混在させており、
`block.rs` では delivery HTTP が DB write **より先** に実行される。delivery 失敗や
プロセスクラッシュで DB 状態と AP 履歴が不一致になりうる。

## 設計判断 (host 側で確定済み / Stage 5 から継承)

1. **UoW 対象**
   - `BlockAccountUseCase` / `UnblockAccountUseCase` (`application/src/service/block.rs`)
   - inbox `Follow` ハンドラ (`handle_follow_activity`)
   - inbox `Block` ハンドラ (`handle_block_activity`)
   - inbox `Undo(Block)` ハンドラ (`handle_undo_block_activity`)
   これらは local DB write が複数 (relation + follow 解除 + outbox insert)
   かつ AP delivery を伴う。

2. **冪等 repo 操作対象**
   - `MuteAccountUseCase` / `UnmuteAccountUseCase`
   - inbox `Accept` ハンドラ (`handle_accept_activity`)
   - inbox `Undo(Follow)` ハンドラ (`handle_undo_follow`)
   これらは単一 write で、重複 activity や再試行を許容すべき。

3. **AP 配送 outbox 化**
   DB tx 内で outbox テーブルに activity を書き込み、commit 成功後に delivery
   HTTP を行う。`outbox_activities` テーブルに delivery 状態カラム
   (`delivered_at` / `attempted_at` / `error`) を追加し、`create` が発行した
   `outbox_id` を返すようにする。`pending_deliveries` / `mark_delivered` /
   `mark_attempted` で delivery 状態を管理。post-commit 即時 delivery を
   baseline とし、long-running worker 化は optional。

4. **TransactionManager 注入**
   Stage 4/6 と同じ `DependOnTransactionManager` trait 経由で
   `TransactionManager` を注入。Service は
   `transaction_manager().transaction(|conn| async move { ... })` で UoW を宣言。
   Stage 8 で adapter crate は解体済み。配線は現行の route facade + 集約済み DI
   (`server/src/route/**` / AppModule) に従う。

5. **Repository 冪等化**
   `insert_if_absent`、`delete_if_exists`、`approve_follow_if_pending` 等を
   kernel port に追加し、driver で UNIQUE/部分 index + `ON CONFLICT DO NOTHING`
   または条件付き `UPDATE` で実装。既存 `create`/`delete` も維持し parallel
   change。

6. **参考資料**
   PR #33 (closed) の branch `claude/crud-ap-transactions-stage5` に Stage 5 の
   実装 diff が残っている。アーキテクチャが Stage 6-8 で変わっているため
   **そのまま cherry-pick / rebase はしない**。設計意図の参照のみに用い、
   現行 main の構造 (route facade / ES Profile / CRUD AuthAccount) に沿って
   実装し直すこと。

## Scope

- `BlockAccountUseCase` / `UnblockAccountUseCase` の UoW 移行 + outbox 化
  (現行: delivery が DB write より先に実行される順序の解消を含む)
- inbox `Follow` / `Block` / `Undo(Block)` ハンドラの UoW 移行 + Accept/outbox 化
- `Mute` / `Accept` / `Undo Follow` / `Undo Block` の冪等 repo 操作化
- `outbox_activities` への delivery state カラム追加マイグレーション
- `OutboxActivityRepository` の delivery 操作拡張
  (`create` が id を返す / `pending_deliveries` / `mark_delivered` / `mark_attempted`)
- `TransactionManager` の注入配線 (現行 AppModule / route facade 構造に従う)
- 関連テストの追加・修正

## Out of scope

- outbound `SendFollow` / `SendUndoFollow` の tx + outbox 化
  (既存 `outbound_follow.rs` / `outbound_unfollow.rs` は変更しない。必要なら別 issue)
- Mute の連合通知 (非連合のまま)
- Block 成立時の `Reject(Follow)` 送信
- 配送 worker の long-running process 化
- host 側 ADR の根拠表記修正 (host が実施済み。child 側のスコープ外)
- Stage 6/7/8 で完了済みの領域 (AuthAccount CRUD / Profile・Metadata ES /
  route facade) への手入れ

## Verification

- UoW 移行前後の等価性テスト (characterization / equivalence)
- rollback テスト: tx 内で失敗させ、blocks / follows / mutes /
  outbox_activities / projection テーブルが元に戻る
- delivery outbox テスト: outbox insert が tx 内、delivery HTTP が commit 後に
  呼ばれ、失敗時に `mark_attempted` + `error` が記録される
- 冪等 repo 操作テスト: 重複 Mute / Accept / Undo Follow / Undo Block が
  idempotent に処理される
- Block / Mute / Follow 系の既存振る舞い (Block 時の双方向 follow 解除、
  リモート Mute 非連合) の維持
- `cargo fmt --check` / `cargo check --workspace` /
  `cargo clippy --workspace -- -D warnings` /
  `cargo test --workspace` (DATABASE_URL あり) / e2e (compose) green
- `git diff --check` clean

## Knowledge Maintenance (G461, optional)

- Intent placement: `intents/emumet/decisions/0006-architecture-realignment-transaction-projection.md`
- ADR candidate: host 側で実施済み (Stage 5 確定セクションの根拠表記修正 +
  Stage 9 確定値の追記は closeout 時)。child 側の ADR 更新は不要
- Diagram candidate: none
- Docs update: none
- Closeout learning: Stage 9 確定値 (現行 main 上での UoW / 冪等操作 / delivery
  outbox の最終 signature)、PR #33 diff からの再利用率、rebase せず再実装した
  判断の妥当性
- Guide reachability (G645): `no_role_facing_surface: true` — HTTP ルート追加なし。
  use case / repository / delivery の内部構造のみ変更

`improve` (G456 / G460) is the later safety net; packet-time maintenance is the normal path.
