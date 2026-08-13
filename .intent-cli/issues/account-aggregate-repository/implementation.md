# account-aggregate-repository Implementation Packet

## Goal

ADR 0006 (アーキテクチャ再配置) Stage 2。kernel に ES 集約用の
`AggregateRepository` port (`load → Rehydrated<Account>`、`save(aggregate,
ExpectedVersion)`、決定3) を定義し、driver (Postgres) に実装する。
`Rehydrated<A>` で aggregate と version を分離する (決定9)。旧
`AccountCommandProcessor` / `AccountEventStore` 経路は残したまま同値テストで
並走させ、main green を維持する。Stage 冒頭の純粋 rename commit
(`KnownEventVersion` → `ExpectedVersion`、ADR §10) も本スライスに含む。

## Why

Stage 1 で `TransactionManager` port と event seq 列が入った。Stage 3
(projection log tailing) と Stage 4 (ユースケース UoW 移行) は、集約の
load/save を担う repository port がないと進められない。現行は
`AccountCommandProcessor` (adapter) が event persist・read model 書込み・
Signal emit を抱え込んでおり、責務の切り分け (決定1: event append は driver の
repository 実装内部) の最初の踏み石として、event append のみを担う port を
Account で縦切り導入する。

## Scope

- 純粋 rename commit (Stage 冒頭、独立コミット): `KnownEventVersion` →
  `ExpectedVersion`、`Nothing` / `Prev(v)` → `Nothing` / `At(v)`
  (ADR §10。楽観排他の意味を明示)
- kernel に `AggregateRepository` port 定義: `load(id) → Rehydrated<Account>`、
  `save(aggregate, ExpectedVersion)`。`Rehydrated<A>` 型 (aggregate + version の
  分離) も kernel に定義し、`rehydrate_account` の `(Account, EventVersion)`
  タプル返しを置き換える
- driver (Postgres) 実装: event append のみを担う。楽観排他は現行
  `persist_internal` と同一セマンティクス (`Nothing`: NOT EXISTS ガード、
  `At(v)`: MAX(version) 一致ガード、衝突時 `KernelError::Concurrency`)。
  repository は外側の transaction に参加するだけで、nested transaction を
  独自に開始しない (決定2)
- 同値テスト: 同一コマンド列を旧経路 (`AccountEventStore`) と新経路で実行し、
  event stream (内容・version 順) と rehydrate 結果の一致を
  `#[test_with::env(DATABASE_URL)]` で検証
- 旧 `AccountCommandProcessor` / `AccountEventStore` は shim として残す
  (呼出側の移行は Stage 4)

## Out of scope

- ユースケース (Service) の新 repository への移行・UoW 化 (Stage 4)
- 直接 Signal emit の停止・event + 通知の同一 tx 化・projector 実装 (Stage 3)
- read model 書込み (`accounts` テーブル) の新 repository への集約
  (Stage 3 の ProjectionWriter / Stage 4)
- `AccountStatus` の nullable カラム折り畳みのドメイン不変条件 API 化
  (決定9 の read model 側。Stage 3/7)
- Profile / Metadata 集約への横展開 (Stage 7)
- `*CommandProcessor` / `*ReadModel` 等の旧名の削除 (parallel change、
  参照ゼロ後の Stage 8)

## Verification

- 同値テストの実行 (`#[test_with::env(DATABASE_URL)]`、compose Postgres 相手)
- rename commit と挙動変更 commit の分離を PR のコミット列で確認
- `cargo test` (DATABASE_URL あり) / clippy が緑
- `git diff --check`

## Knowledge Maintenance (G461, optional)

- Intent placement: ADR 0006 が source of truth (新規 intent ノード不要)
- ADR candidate: AggregateRepository / Rehydrated<A> の確定 signature を
  ADR 0006 決定3・決定9 に追記 (closeout で処理)
- Diagram candidate: なし
- Docs update: なし (Emumet AGENTS.md Architecture 節の更新は移行完了後)
- Closeout learning: port の確定 signature と rename で浮上した制約
  (write_back_required: true、ADR 0006 への追記)

- Guide reachability (G645): packet.yaml の guide_reachability を参照
  (no_role_facing_surface: true — 内部基盤のみの変更)

`improve` (G456 / G460) is the later safety net; packet-time maintenance is the normal path.
