# account-aggregate-repository: AggregateRepository port (Rehydrated<Account>) + driver 実装 + 同値テスト並走 (ADR 0006 Stage 2)

## Goal

ADR 0006 (アーキテクチャ再配置) Stage 2。kernel に ES 集約用の
`AggregateRepository` port (`load → Rehydrated<Account>`、`save(aggregate,
ExpectedVersion)`、決定3) を定義し、driver (Postgres) に実装する。
`Rehydrated<A>` で aggregate と version を分離する (決定9)。旧
`AccountCommandProcessor` / `AccountEventStore` 経路は残したまま同値テストで
並走させ、main green を維持する。Stage 冒頭の純粋 rename commit
(`KnownEventVersion` → `ExpectedVersion`、ADR §10) も本スライスに含む。

## Why This Slice Exists Now

Stage 1 (PR #25) で `TransactionManager` port (Box::pin closure 版) と event
テーブルの seq 列が入った。Stage 3 (projection log tailing) と Stage 4
(ユースケース UoW 移行) は、集約の load/save を担う repository port がないと
進められない。現行の `AccountCommandProcessor` (adapter) は event persist・
read model 書込み・Signal emit を抱え込んでおり、決定1 の責務切り分け
(event append は driver の repository 実装内部) の最初の踏み石として、
event append のみを担う port を Account で縦切り導入する。

## Current Observed State

- `kernel/src/event_store/account.rs` の `AccountEventStore` が
  persist / persist_and_transform / find_by_id を提供。楽観排他は
  `driver/src/database/postgres/account_event_store.rs` の `persist_internal` で、
  `KnownEventVersion::Nothing` なら NOT EXISTS ガード、`Prev(v)` なら
  MAX(version)=v ガード、衝突時は `KernelError::Concurrency`
- `application/src/service/account/rehydrate.rs` の `rehydrate_account` が
  `(Account, EventVersion<Account>)` のタプルを返す。これが `Rehydrated<A>`
  分離の seam (ADR 0006 決定9)
- `adapter/src/processor/account/command.rs` の `AccountCommandProcessor` は
  event persist に加えて read model 書込み (create / link_auth_account) と
  直接 Signal emit を行う。新 repository は event append のみを担い、
  これらは移行しない (Stage 3/4 の責務)
- `kernel/src/entity/event/version.rs` の `KnownEventVersion` (Nothing / Prev) は
  ADR 0006 §10 で `ExpectedVersion` (Nothing / At(v)) への rename 対象
- `kernel/src/repository/` には既に CRUD 系 port (FollowRepository 等) があり、
  DependOn* パターン・Connection 型付随の port 形状が確立している

## Accepted Baseline You May Assume

- ADR 0006 全体 (決定1: 責務の3分散、決定2: repository は外側 transaction に
  参加するだけで nested transaction を開始しない、決定3: 4系統の port 文法、
  決定9: Rehydrated<A> による aggregate/version 分離、決定10: 命名正規化の
  実施ルール)
- Stage 1 完了済み: `TransactionManager` port (Box::pin closure 版) と
  event テーブル seq 列が導入済み (PR #25)
- rust-toolchain は 1.97.0
- DB テストは `#[test_with::env(DATABASE_URL)]` で compose の Postgres 16
  相手に実行する既存規約
- rename は各 Stage 冒頭の純粋 rename commit として分離し、挙動変更と混ぜない
  (ADR §10 実施ルール)。新しい名前で書き始めてから旧名を消す
  (parallel change) を徹底する

## Target Repo / Path / Part

Repository: `ShuttlePub/Emumet`

Target paths: `kernel/src/repository, kernel/src/entity/event, driver/src/database/postgres, application/src/service/account/rehydrate.rs`

Target part: `AggregateRepository<Account> port + Postgres 実装 + 旧 CommandProcessor との同値テスト並走 + Stage 2 冒頭の純粋 rename (KnownEventVersion→ExpectedVersion)`

## In Scope

- 純粋 rename commit (Stage 冒頭、独立コミット): `KnownEventVersion` →
  `ExpectedVersion`、`Nothing` / `Prev(v)` → `Nothing` / `At(v)`
- kernel への `AggregateRepository` port 定義
  (`load(id) → Rehydrated<Account>`、`save(aggregate, ExpectedVersion)`)
  と `Rehydrated<A>` 型の定義。Account が最初の対象集約。
  `rehydrate_account` の `(Account, EventVersion)` タプル返しを
  `Rehydrated<Account>` に置き換える
- driver (Postgres) 実装: event append のみ。楽観排他は現行
  `persist_internal` と同一セマンティクス (Nothing: NOT EXISTS ガード /
  At(v): MAX(version) 一致ガード / 衝突時 KernelError::Concurrency)。
  外側の transaction に参加するだけで nested transaction は開始しない
- 同値テスト: 同一コマンド列 (Created → Updated → 各 moderation イベント) を
  旧経路 (`AccountEventStore`) と新経路で実行し、event stream (内容・
  version 順) と rehydrate された aggregate の一致を
  `#[test_with::env(DATABASE_URL)]` で検証
- 旧 `AccountCommandProcessor` / `AccountEventStore` は shim として残し
  main green を維持

## Out Of Scope

- ユースケース (Service) の新 repository への移行・UoW 化
  (Stage 4 `account-write-usecases`)
- 直接 Signal emit の停止・event + 通知の同一 tx 化・projector 実装
  (Stage 3 `projection-outbox-projector`)
- read model 書込み (`accounts` テーブル) の新 repository への集約
  (Stage 3 の ProjectionWriter / Stage 4)
- `AccountStatus` の nullable カラム折り畳みのドメイン不変条件 API 化
  (決定9 の read model 側。Stage 3/7)
- Profile / Metadata 集約への横展開 (Stage 7 `es-aggregates-migration`)
- 旧名 (`*CommandProcessor` / `AccountEventStore` 等) の削除
  (参照ゼロ後の Stage 8 `di-cleanup-adapter-removal`)

## Standalone Child Issue Contract

Emumet のアーキテクチャ再配置 (ADR 0006) の Stage 2 として、まず Stage 冒頭の
純粋 rename commit (`KnownEventVersion` → `ExpectedVersion`、
`Nothing` / `Prev(v)` → `Nothing` / `At(v)`) を独立コミットで実施する。
次に kernel に ES 集約用の `AggregateRepository` port
(`load(id) → Rehydrated<Account>`、`save(aggregate, ExpectedVersion)`) と
`Rehydrated<A>` 型を定義し、`rehydrate_account` が返す
`(Account, EventVersion)` タプルを `Rehydrated<Account>` に置き換える。
driver (Postgres) 実装は event append のみを担い、楽観排他は現行
`persist_internal` と同一セマンティクス (Nothing: NOT EXISTS ガード /
At(v): MAX(version) 一致ガード / 衝突時 KernelError::Concurrency) とし、
外側の transaction に参加するだけで nested transaction は開始しない。
同一コマンド列を旧経路 (`AccountEventStore`) と新経路で実行して event
stream と rehydrate 結果が一致することを示す同値テストを
`#[test_with::env(DATABASE_URL)]` で追加する。旧
`AccountCommandProcessor` / `AccountEventStore` は shim として残し、
read model 書込み・Signal emit の移行や Service の切替は後続 Stage の
スコープであり、本 PR では port と driver 実装の並走導入までで main green
を維持する。

## Acceptance Criteria

- 純粋 rename commit (`KnownEventVersion` → `ExpectedVersion`、
  `Prev` → `At(v)`) が挙動変更コミットから分離され、rename commit 単体で
  テストが緑 (挙動非変更) である
- kernel に `AggregateRepository` port
  (`load → Rehydrated<Account>`、`save(aggregate, ExpectedVersion)`) が
  定義され、driver に Postgres 実装がある。Account が最初の対象集約
- `Rehydrated<A>` 型が aggregate と version を分離して返し、
  `rehydrate_account` のタプル返しが置き換わっている
- save の楽観排他が現行 `persist_internal` と同じセマンティクス
  (Nothing: NOT EXISTS ガード / At(v): MAX(version) 一致ガード /
  衝突時 `KernelError::Concurrency`)
- 同値テストで、同一コマンド列に対する新旧両経路の event stream
  (内容・version 順) と rehydrate された aggregate が一致する
- 旧 `AccountCommandProcessor` / `AccountEventStore` は shim として残り
  main green。新 repository は read model 書込み・Signal emit を行わない
- `cargo test` (DATABASE_URL あり) / clippy が緑

## Verification

- 同値テストの実行 (`#[test_with::env(DATABASE_URL)]`、compose Postgres 相手)
- rename commit と挙動変更 commit の分離を PR のコミット列で確認
- `git diff --check`

## Related Links

- ADR: intents/emumet/decisions/0006-architecture-realignment-transaction-projection.md
- backlog: intents/emumet/packets/backlog.md (Ready #2)
- Stage 1: ShuttlePub/Emumet PR #25 (TransactionManager port + seq 列)

## Knowledge Maintenance

- Intent placement: ADR 0006 が source of truth (新規 intent ノード不要)
- ADR candidate: AggregateRepository / Rehydrated<A> の確定 signature を
  ADR 0006 決定3・決定9 に追記 (closeout で処理)
- Diagram candidate: none
- Docs update: none (Emumet AGENTS.md Architecture 節の更新は移行完了後、
  ADR Links 参照)
- Closeout writeback expected: yes (port の確定 signature を ADR 0006 に追記)

## Guide Reachability (G645)

No role-facing surface added — 内部アーキテクチャ基盤のみの変更
(packet.yaml `guide_reachability.no_role_facing_surface: true` 参照)。

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open all child PRs against `main` directly.
