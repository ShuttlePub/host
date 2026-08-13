# architecture-foundation: TransactionManager port 導入・no-op commit 廃止・event seq 列追加 (ADR 0006 Stage 1)

## Goal

ADR 0006 (アーキテクチャ再配置) Stage 1 の土台整備。後続 Stage が依存する基盤として、
(1) 現行振る舞いを固定する characterization tests、(2) no-op `Executor::commit`
デフォルト実装の廃止、(3) kernel への `TransactionManager` port 定義 + driver 実装 +
signature spike (AsyncFnOnce vs Box::pin)、(4) 4 event テーブルへの `seq BIGSERIAL`
列追加 migration、を行う。Stage 冒頭の純粋 rename commit (ADR §10) も本スライスに含む。

## Why This Slice Exists Now

CreateAccount (Account + Profile + SigningKey + 権限の4書き込み) が現状アトミックでなく、
atomicity 欠落は現在進行形のデータ不整合リスク。ADR 0006 (2026-08-13 Accepted) は
8 ユニットの段階移行を定めており、本ユニットはその先頭。Stage 2 (AccountRepository
port)・Stage 3 (projection log tailing)・Stage 4 (usecase UoW 移行) はすべて
本 Stage の `TransactionManager` port と event seq 列の上に成り立つ。

## Current Observed State

- `application/src/service/**` の全ユースケースが
  `database_connection().get_executor()` (auto-commit プール接続) を取得し、
  `transaction` と名付けた変数で下位に回している (例: account/create.rs:41)。
  真の transaction (`get_transaction()` + `commit()`) は
  account_detail/update.rs:65 の1箇所のみ
- kernel/src/database.rs の `Executor::commit` はデフォルト no-op 実装
  (`async { Ok(()) }`)。`PostgresConnection::Connection` (auto-commit) の commit も
  `Ok(())` を返す (driver/src/database/postgres.rs:72) ため、実装漏れが
  正常終了に見える構造的原因になっている
- 4 つの event テーブル (account_events / auth_account_events / profile_events /
  metadata_events) は `(id, version)` PK のみでグローバル連番を持たない
  (migrations/20230707210300_init.sql:92-124)
- `TransactionManager` port は未存在。object safety は取らない方針 (ジェネリクス維持)

## Accepted Baseline You May Assume

- ADR 0006 全体 (決定2: Transaction の所有は DataStore・宣言は Service、決定4:
  seq + checkpoint による log tailing、決定7: object safety 非採用、決定10:
  命名正規化の実施ルール)
- rust-toolchain は 1.97.0。`AsyncFnOnce` + `F::CallOnceFuture: Send` は
  Rust 1.85+ で利用可能
- DB テストは `#[test_with::env(DATABASE_URL)]` で compose の Postgres 16 相手に
  実行する既存規約 (Emumet AGENTS.md Testing 節)
- rename は各 Stage 冒頭の純粋 rename commit として分離し、挙動変更と混ぜない
  (ADR §10 実施ルール)

## Target Repo / Path / Part

Repository: `ShuttlePub/Emumet`

Target paths: `kernel/src/database.rs, driver/src/database, application/src/service, migrations/`

Target part: `TransactionManager port 導入・no-op commit 廃止・event seq 列追加・characterization tests・Stage 1 冒頭の純粋 rename`

## In Scope

- 純粋 rename commit (Stage 冒頭、独立コミット): `Executor` trait → `Connection`、
  `get_executor()` → `connection()`、auto-commit 接続を指す変数名 `transaction` → `conn`
- characterization tests: CreateAccount (Account + Profile + SigningKey + 権限の
  4書き込み) と UpdateAccountDetail の現行振る舞いを `#[test_with::env(DATABASE_URL)]`
  形式で固定
- no-op `Executor::commit` 廃止: auto-commit 接続で commit が成功を装う経路を除去し、
  `get_transaction()` 由来の transaction のみが commit 手段を持つ型設計にする
  (update.rs の既存経路は挙動を変えず追従)
- kernel への `TransactionManager` port 定義 + driver (Postgres) 実装。Service は
  closure で原子範囲を宣言するだけで begin/commit/rollback に触れない形。
  signature は `AsyncFnOnce` (`F::CallOnceFuture: Send`) を spike 検証し、
  不可なら `Box::pin` 版で進める (採否と理由を記録)
- 4 event テーブルへの `seq BIGSERIAL` 列追加 migration (既存行を壊さない)

## Out Of Scope

- ユースケースの UoW / TransactionManager 移行 (Stage 4 `account-write-usecases`)
- `AccountRepository` port + 同値テスト並走 (Stage 2 `account-aggregate-repository`)
- 直接 Signal emit 停止・projector の event tail 実装・checkpoint テーブル
  (Stage 3 `projection-outbox-projector`)
- adapter クレート解体・facade newtype 化 (Stage 8 `di-cleanup-adapter-removal`)
- `Executor` / `get_executor` 以外の rename (`*CommandProcessor` → `AggregateRepository`
  等は各 Stage 冒頭で実施)
- KetoClient の driver 移動 (Stage 4)

## Standalone Child Issue Contract

Emumet のアーキテクチャ再配置 (ADR 0006) の Stage 1 として、まず Stage 冒頭の
純粋 rename commit (`Executor` → `Connection` / `get_executor()` → `connection()` /
変数名 `transaction` → `conn`) を独立コミットで実施する。次に CreateAccount と
UpdateAccountDetail の現行振る舞いを固定する characterization tests を追加する。
その上で、kernel の `Executor` (rename 後 `Connection`) から no-op デフォルトの
`commit` を廃止して auto-commit 接続で commit が成功を装う経路を除去し、
kernel に `TransactionManager` port を定義して driver (Postgres) が実装する
(Service は closure で原子範囲を宣言するだけの形。signature は `AsyncFnOnce` を
spike 検証し、不可なら `Box::pin`)。最後に 4 event テーブルへ `seq BIGSERIAL`
列を追加する migration を加える。ユースケースの移行や projector 側の利用は
後続 Stage のスコープであり、本 PR では port と基盤の導入までで main green を維持する。

## Acceptance Criteria

- 純粋 rename commit が挙動変更のコミットから分離されており、rename commit 単体で
  テストが緑 (挙動非変更) である
- CreateAccount (4書き込み) と UpdateAccountDetail の characterization tests が
  現行 main の振る舞いを固定し、本 PR の変更前後で緑
- auto-commit 接続 (`connection()` 経由) では commit 手段が存在しない (または
  コンパイル時に呼べない) 形になり、no-op デフォルト実装が除去されている
- kernel に `TransactionManager` port、driver に Postgres 実装があり、closure 内で
  begin/commit/rollback が完結する。closure 内でエラー時に rollback されることが
  テストで確認できる
- signature spike の結果 (AsyncFnOnce 採否と理由) が PR description に記録されている
- 4 event テーブルに `seq` 列 (BIGSERIAL) が追加される migration があり、
  既存マイグレーションを破壊しない
- `cargo test` (DATABASE_URL あり) / clippy が緑

## Verification

- characterization tests の実行 (`#[test_with::env(DATABASE_URL)]`、compose Postgres 相手)
- `TransactionManager` driver 実装の commit / rollback テスト
- rename commit と挙動変更 commit の分離を PR のコミット列で確認
- `git diff --check`

## Related Links

- ADR: intents/emumet/decisions/0006-architecture-realignment-transaction-projection.md
- backlog: intents/emumet/packets/backlog.md (Ready #1)

## Knowledge Maintenance

- Intent placement: ADR 0006 が source of truth (新規 intent ノード不要)
- ADR candidate: spike 結果の確定のみ (ADR 0006 決定7 への追記として closeout で処理)
- Diagram candidate: none
- Docs update: none (Emumet AGENTS.md Architecture 節の更新は移行完了後、ADR Links 参照)
- Closeout writeback expected: yes (TransactionManager signature spike の採否を
  ADR 0006 決定7 に追記)

## Guide Reachability (G645)

No role-facing surface added — 内部アーキテクチャ基盤のみの変更
(packet.yaml `guide_reachability.no_role_facing_surface: true` 参照)。

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open all child PRs against `main` directly.
