# projection-outbox-projector: account_events log tailing + application::projection AccountProjector 新設 + 直接 Signal emit 停止 (ADR 0006 Stage 3)

## Goal

ADR 0006 (アーキテクチャ再配置) Stage 3。projection 通知を processor からの
直接 Signal emit から event テーブルの transactional log tailing へ切り替える
(決定4)。Account を縦切り対象として、`account_events` を checkpoint テーブル +
`seq` で tail する基盤を導入し、Account projector を `application::projection`
に新設する (決定6)。投影書込みは kernel の `AccountProjectionWriter` port
(version-gated upsert、決定3) で冪等化し、AccountCommandProcessor からの直接
emit と Redis 駆動の `AccountApplier` を廃止する。main green を維持する。

## Why This Slice Exists Now

現行は event INSERT (DB tx) と Signal emit (Redis push) が**別の原子単位**であり、
commit 後・emit 前のクラッシュや emit 失敗で投影が永久に欠落しうる。
`AccountCommandProcessor` の create にある「回復用 emit」(read model 書込み
失敗時に emit して非同期側に修復を委ねる経路) はこの脆弱性の存証であり、
決定4 が「欠落保証は DB 行 (event) が担う」への移行を既に決定している。
Stage 1 (PR #25) で `seq BIGSERIAL` 列、Stage 2 (PR #27) で `AggregateRepository`
port が揃い、tailing の足場は完成した。Stage 4 (ユースケース UoW 化) は投影の
配送保証が DB 行に移っていることを前提に read model 同期書込みの扱いを
決めるため、本 Stage が先になる。

## Current Observed State

- `Signal<ID>` trait は `kernel/src/signal.rs` (`kernel::interfaces::signal` で
  再エクスポート)。実装は server の 4 applier で、emit の実体は rikka-mq の
  Redis キューへの push。**ペイロードは集約 ID のみ**で、イベント本体は消費側が
  event store から再読込する
- emit 呼出箇所は全 17 箇所、全て adapter の CommandProcessor。account は
  `adapter/src/processor/account/command.rs` に 7 箇所 (create の回復用 2 +
  成功後 1、update、deactivate、suspend、unsuspend、ban)
- `AccountApplier` (`server/src/applier/account_applier.rs`) が Redis キュー
  `"account_applier"` を消費し、既存投影取得 → 差分イベント再読 →
  `Account::apply` → create + `link_auth_account` + Keto Owner relation /
  deactivate cascade / ban / suspend / update を実行する
- account read model は**二重経路**で書かれる: コマンドパス内の同期書込み
  (`command.rs` の create、`application/src/service/account_detail/update.rs` の
  update) + Signal → applier の非同期再適用
- `accounts.version BIGINT NOT NULL` 列はあり read model UPDATE も version を
  書くが、**`WHERE id = $1` のみで version ゲートは存在しない**
  (`driver/src/database/postgres/account/mod.rs`)。冪等性は applier 側の
  since-version 差分適用で擬似的に担保している
- 4 イベントテーブルに `seq BIGSERIAL` 列はある (Stage 1) が、**index なし・
  参照するクエリなし・checkpoint / watermark テーブルなし**
- `application::projection` モジュールは存在しない (application/src は
  permission / service / signing_key / transfer のみ)
- ワーカーは `AppModule::new` → `ApplierContainer::new` → 各 applier の
  `queue.start_workers()` で rikka-mq が `tokio::spawn` する fire-and-forget。
  **shutdown 管理は皆無**
- `outbox_activities` は ActivityPub 配送用の別物 (公開コレクション表示用の
  追記ストア。バックグラウンド配送ワーカーは存在しない) で、本スライスの
  対象外 (決定4 で統合却下済み)

## Accepted Baseline You May Assume

- ADR 0006 全体 (決定2: transaction は DataStore 完結、決定3: 4系統の port 文法と
  `*ProjectionWriter`、決定4: transactional log tailing、決定6: projector の配置
  — 調停は application::projection、SQL/checkpoint は driver、worker 起動は
  server、決定9: ドメイン / projection 分離、決定10: 命名正規化の実施ルール)
- ADR 0006 への writeback 済み設計入力:
  - Stage 1 review より: BIGSERIAL の払出順は commit 順と一致しないため
    素朴な単調 tailing は取りこぼしうる。`seq` への index も未付与
  - Stage 2 review より: グローバル tailing (seq 順) と per-stream rehydration
    (version 順) の順序規則を明示的に分ける。`Rehydrated::from_events` は
    入力列の最後の envelope を境界 version とするため、読み出し順を seq に
    変えてもそのまま利用できる
- Stage 1 / Stage 2 完了済み (PR #25 / PR #27 マージ済み)
- rust-toolchain は 1.97.0
- DB テストは `#[test_with::env(DATABASE_URL)]` で compose の Postgres 16
  相手に実行する既存規約
- 移動と挙動変更は別 commit に分離する (ADR §10 実施ルール)。parallel change
  (新しい名前で書き始めてから旧名を消す) を徹底し、main green を維持する

## Target Repo / Path / Part

Repository: `ShuttlePub/Emumet`

Target paths: `kernel/src/repository, application/src/projection (新設), driver/src/database/postgres, server/src/applier, server/src/handler.rs, adapter/src/processor/account/command.rs, migrations/`

Target part: `account_events log tailing 基盤 (checkpoint + seq index + 窓再読) + application::projection AccountProjector 新設 + AccountProjectionWriter port (version-gated upsert) + account 直接 Signal emit 停止と AccountApplier 廃止`

## In Scope

- 純粋 move commit (Stage 冒頭、独立コミット): `AccountApplier` の調停ロジック
  (既存投影取得 → 差分イベント再読 → `Account::apply` → create / link / Keto
  Owner / deactivate cascade / ban / suspend / update の分岐) を
  `application::projection::AccountProjector` へ機械的に移動する
  (この commit では Redis 駆動・SQL・分岐を一切変えない)
- migration: `projection_checkpoints(projector_name TEXT PRIMARY KEY, last_seq
  BIGINT NOT NULL, updated_at TIMESTAMPTZ NOT NULL)` 相当の汎用 checkpoint
  テーブル新設 + `account_events(seq)` への index 追加
- kernel: `AccountProjectionWriter` port (version-gated upsert) と、checkpoint
  読み書き・seq 窓読み出しを担う port 群の定義
- driver (Postgres): 上記 port の実装。tail 読み出し → 投影書込み →
  checkpoint 更新は同一 transaction で行う。tailing プロトコルは
  **checkpoint + 重複窓の再読 (window re-read)** とし、`seq > checkpoint - W`
  を `ORDER BY seq LIMIT N` で読む。**素朴な単調 tail (`seq > checkpoint` のみ)
  は禁止** (BIGSERIAL の払出順 ≠ commit 順で取りこぼすため)
- `application::projection::AccountProjector`: 調停ロジック (fold、deactivate
  cascade、Keto Owner provisioning 判断)。同一集約のイベントは **version 順に
  整列してから fold** する (seq 順に依存しない)
- server: tailing worker (poll 駆動、interval 設定可能、CancellationToken 等の
  graceful shutdown 付き) を起動経路に追加
- adapter: `AccountCommandProcessor` からの emit 全 7 箇所削除、
  `AccountApplier` / `account_applier` Redis キュー / `DependOnAccountSignal`
  配線の除去 (parallel change: 新経路が動いてから旧経路を消す)
- 冪等化: projector 経由の `accounts` 書込みを version-gated upsert
  (`INSERT ... ON CONFLICT (id) DO UPDATE ... WHERE version < EXCLUDED.version`
  または `UPDATE ... WHERE id = $1 AND version < $v`) に置換
- テスト: 冪等性 (同一イベント再適用で read model 不変・古い version の適用は
  no-op)、コミット順序逆転での取りこぼしなし、per-aggregate 逆順到着の収束、
  checkpoint 進行

## Out Of Scope

- profile / metadata / auth_account の applier・emit の移行
  (Redis 経路を維持。Stage 6 / Stage 7)
- ユースケース (Service) の UoW 移行、コマンドパス内の同期 read model 書込み
  (`command.rs` create、`account_detail/update.rs` update) の削除
  (Stage 4 `account-write-usecases`)
- append 側 CAS の原子性強化 (UNIQUE 制約・advisory lock。
  Stage 2 review の設計入力として Stage 4 で検証)
- `Signal` → `ProjectionNotifier`、`*ReadModel` → `*Query` + `*ProjectionWriter`
  の全面 rename (残り 3 集約の emit が残るため後続 Stage)
- `outbox_activities` (ActivityPub 配送) との統合 (決定4 で却下済み)
- `AccountStatus` の nullable カラム折り畳みのドメイン不変条件 API 化 (Stage 7)

## Standalone Child Issue Contract

Emumet のアーキテクチャ再配置 (ADR 0006) の Stage 3 として、Account の投影
通知を直接 Signal emit から event テーブルの log tailing に切り替える。まず
Stage 冒頭の純粋 move commit として `AccountApplier` の調停ロジックを
`application::projection::AccountProjector` へ機械的に移動する (この commit
では Redis 駆動・SQL・分岐を変えず、単体でテストが緑であること)。次に、
`projection_checkpoints` テーブルと `account_events(seq)` index の migration
を追加し、kernel に `AccountProjectionWriter` port (version-gated upsert) と
checkpoint 読み書き・seq 窓読み出しの port 群を定義して driver (Postgres)
に実装する。tailing は checkpoint + 重複窓の再読 (window re-read) とし、
`seq > checkpoint - W` を seq 順に読み、tail 読み出し → 投影書込み →
checkpoint 更新を同一 transaction で行う (素朴な単調 tail は禁止)。同一集約の
イベントは version 順に整列してから fold する。server に poll 駆動の tailing
worker (interval 設定可能、graceful shutdown 付き) を追加し、新経路の動作後に
`AccountCommandProcessor` の emit 7 箇所・`AccountApplier`・`account_applier`
キューを削除する。コマンドパス内の同期 read model 書込みは本 PR では維持し、
profile / metadata / auth_account の Redis 経路にも触れない。冪等性・
コミット順序逆転・per-aggregate 逆順収束の各テストを
`#[test_with::env(DATABASE_URL)]` で追加し、cargo test / clippy / e2e が緑の
まま main にマージできる状態にする。

## Acceptance Criteria

- 純粋 move commit (AccountApplier 調停ロジック →
  `application::projection::AccountProjector`) が挙動変更 commit から分離され、
  move commit 単体でテストが緑 (挙動非変更) である
- `projection_checkpoints` テーブルと `account_events(seq)` index の migration
  がある
- kernel に `AccountProjectionWriter` port (version-gated upsert) と checkpoint
  読み書き・seq 窓読み出しの port 群が定義され、driver に Postgres 実装がある
- tailing プロトコルが checkpoint + 重複窓の再読であり、素朴な単調 tail
  (`seq > checkpoint` のみで checkpoint を最大読取値まで進める) になっていない。
  tail 読み出し → 投影書込み → checkpoint 更新が同一 transaction
- server に tailing worker があり、poll interval が設定可能で、graceful
  shutdown の仕組み (CancellationToken 等) がある
- 冪等性テスト: 同一イベントの再適用で read model が不変、かつ現在 version
  より古い version の適用が no-op である
- コミット順序逆転テスト: 2 本の接続で seq 払出順と commit 順を逆転させ、
  両イベントが最終的に投影される (単調 tail では落ちるテスト)
- per-aggregate 順序テスト: 同一集約のイベントが seq 順 ≠ version 順で到着
  しても version 順 fold + gate で収束する
- account 経路に直接 Signal emit が残っていない
  (`adapter/src/processor/account/` 内の `.emit(` が 0 件)、`AccountApplier` と
  `account_applier` キューが削除されている。profile / metadata / auth_account
  の Redis 経路は維持されている
- コマンドパスの同期 read model 書込み (create / account_detail update) は
  維持されている
- `cargo test` (DATABASE_URL あり) / clippy が緑、e2e (compose) が緑
  (poll interval が e2e 互換の遅延であること)

## Verification

- 上記テストの実行 (`#[test_with::env(DATABASE_URL)]`、compose Postgres 相手)
- move commit と挙動変更 commit の分離を PR のコミット列で確認
- `adapter/src/processor/account/` の `.emit(` 0 件の grep 証跡
- e2e (compose) の実行
- `git diff --check`

## Related Links

- ADR: intents/emumet/decisions/0006-architecture-realignment-transaction-projection.md
- backlog: intents/emumet/packets/backlog.md (Ready #3)
- Stage 1: ShuttlePub/Emumet PR #25 (TransactionManager port + seq 列)
- Stage 2: ShuttlePub/Emumet issue #26 / PR #27 (AggregateRepository port +
  Rehydrated\<A\>)

## Knowledge Maintenance

- Intent placement: ADR 0006 が source of truth (新規 intent ノード不要)
- ADR candidate: tailing プロトコルの確定値 (窓パラメータ W・checkpoint
  schema・seq index) を決定4 に、projector の確定配置 (module 構成・port 命名)
  を決定3/6/9 に追記 (closeout で処理)
- Diagram candidate: none
- Docs update: none (Emumet AGENTS.md Architecture 節の更新は移行完了後、
  ADR Links 参照)
- Closeout writeback expected: yes (tailing プロトコル確定値と port/型の確定
  命名を ADR 0006 に追記)

## Guide Reachability (G645)

No role-facing surface added — 内部アーキテクチャ基盤のみの変更
(packet.yaml `guide_reachability.no_role_facing_surface: true` 参照)。

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open all child PRs against `main` directly.
