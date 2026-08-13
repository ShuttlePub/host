# architecture-foundation Implementation Packet

## Goal

ADR 0006 (アーキテクチャ再配置) Stage 1 の土台整備。現行振る舞いを固定する
characterization tests、no-op `Executor::commit` 廃止、kernel への
`TransactionManager` port 定義 + driver 実装 + signature spike
(AsyncFnOnce vs Box::pin)、4 event テーブルへの `seq BIGSERIAL` 列追加を行う。
Stage 冒頭の純粋 rename commit (ADR §10) も本スライスに含む。

## Why

CreateAccount (Account + Profile + SigningKey + 権限の4書き込み) が現状
アトミックでなく、atomicity 欠落は現在進行形のデータ不整合リスク。
8 ユニットの段階移行の先頭であり、Stage 2 以降はすべて本 Stage の
`TransactionManager` port と event seq 列の上に成り立つ。

## Scope

- 純粋 rename commit (Stage 冒頭、独立コミット): `Executor` trait → `Connection`、
  `get_executor()` → `connection()`、auto-commit 接続を指す変数名 `transaction` → `conn`
- characterization tests: CreateAccount (4書き込み) と UpdateAccountDetail の
  現行振る舞いを `#[test_with::env(DATABASE_URL)]` 形式で固定
- no-op `Executor::commit` 廃止: auto-commit 接続で commit が成功を装う経路を除去。
  `get_transaction()` 由来の transaction のみが commit 手段を持つ型設計
  (update.rs の既存経路は挙動を変えず追従)
- kernel への `TransactionManager` port 定義 + driver (Postgres) 実装。
  Service は closure で原子範囲を宣言するだけの形。signature は `AsyncFnOnce`
  (`F::CallOnceFuture: Send`) を spike 検証し、不可なら `Box::pin` 版
  (採否と理由を PR description に記録)
- 4 event テーブルへの `seq BIGSERIAL` 列追加 migration (既存行を壊さない)

## Out of scope

- ユースケースの UoW / TransactionManager 移行 (Stage 4)
- `AccountRepository` port + 同値テスト並走 (Stage 2)
- 直接 Signal emit 停止・projector の event tail・checkpoint テーブル (Stage 3)
- adapter クレート解体・facade newtype 化 (Stage 8)
- `Executor` / `get_executor` 以外の rename (各 Stage 冒頭で実施)
- KetoClient の driver 移動 (Stage 4)

## Verification

- characterization tests の実行 (`#[test_with::env(DATABASE_URL)]`、compose Postgres 相手)
- `TransactionManager` driver 実装の commit / rollback テスト
  (closure 内エラー時に rollback されること)
- rename commit と挙動変更 commit の分離を PR のコミット列で確認
- `cargo test` (DATABASE_URL あり) / clippy が緑
- `git diff --check`

## Knowledge Maintenance (G461, optional)

- Intent placement: ADR 0006 が source of truth (新規 intent ノード不要)
- ADR candidate: TransactionManager signature spike 結果の確定を ADR 0006 決定7 に追記
  (closeout で処理)
- Diagram candidate: なし
- Docs update: なし (Emumet AGENTS.md Architecture 節の更新は移行完了後)
- Closeout learning: spike の採否と理由 (write_back_required: true、
  ADR 0006 への追記)

- Guide reachability (G645): packet.yaml の guide_reachability を参照
  (no_role_facing_surface: true — 内部基盤のみの変更)

`improve` (G456 / G460) is the later safety net; packet-time maintenance is the normal path.
