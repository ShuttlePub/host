# projection-outbox-projector Implementation Packet

## Goal

ADR 0006 (アーキテクチャ再配置) Stage 3。projection 通知を processor からの
直接 Signal emit から **event テーブルの transactional log tailing** へ切り替える
(決定4)。Account を縦切り対象として、`account_events` を checkpoint テーブル +
`seq` で tail する基盤を導入し、Account projector を `application::projection` に
新設する (決定6)。投影書込みは kernel の `AccountProjectionWriter` port
(version-gated upsert、決定3) で冪等化し、AccountCommandProcessor からの直接
emit と Redis 駆動の `AccountApplier` を廃止する。

## Why

Stage 1 (PR #25) で `seq BIGSERIAL` 列、Stage 2 (PR #27) で `AggregateRepository`
port が入ったが、`seq` は index もなく参照するクエリもなく、checkpoint 機構も
存在しない。現行の投影通知は event INSERT (DB tx) と Signal emit (Redis push) が
**別の原子単位**であり、commit 後・emit 前のクラッシュや emit 失敗で投影が
永久に欠落しうる (create の「回復用 emit」がこの脆弱性の存証)。決定4 の
「欠落保証は DB 行 (event) が担い、Redis は『起きろ』の合図」への移行は、
Stage 4 (ユースケース UoW 化) が投影の配送保証を DB に委ねる前提となるため、
この順序で実施する。

## 設計判断 (host 側で確定済み)

1. **tailing プロトコルのベースライン**: Stage 1 review の設計入力
   (BIGSERIAL の払出順は commit 順と一致しない) を受け、**素朴な単調 tail
   (`seq > checkpoint` で checkpoint を読んだ最大値まで進める) は禁止**とする。
   ベースラインは **checkpoint + 重複窓の再読 (window re-read)**: 毎 poll で
   `seq > checkpoint - W` を `ORDER BY seq LIMIT N` で読み、at-least-once 配送を
   version-gated upsert の冪等性で吸収する。W の既定値・上限・調整規則は実装で
   確定し、ADR 0006 決定4 に writeback する。テーブル別 checkpoint は**可**
   (本 Stage は `account_events` のみ tail。checkpoint テーブルは
   `projection_checkpoints(projector_name TEXT PRIMARY KEY, last_seq BIGINT NOT NULL,
   updated_at TIMESTAMPTZ NOT NULL)` 相当の汎用 schema とし、後続 Stage の
   横展開を妨げない)。`account_events(seq)` への index 追加も本スライスに含む
   (Stage 1 review 指摘)。
2. **順序規則の分離** (Stage 2 review の設計入力、決定9): グローバル tailing は
   `seq` 順、per-aggregate の fold は `version` 順とし、両者を混同しない。
   projector は同一集約のイベントを **version 順に整列してから fold** し、
   境界 version は `Rehydrated::from_events` と同じく最後の envelope から取る。
   同一集約イベントが seq 順 ≠ version 順で到着しても収束することをテストで
   固定する。
3. **コミット順序逆転の regression test 必須**: 2 本の接続で seq 払出順と
   commit 順を逆転させた上で、両イベントが最終的に投影されることを
   `#[test_with::env(DATABASE_URL)]` で検証する (単調 tail なら落ちるテスト)。
4. **移動と挙動変更の分離** (決定10 実施ルール): Stage 冒頭に純粋な
   move commit として `server/src/applier/account_applier.rs` の調停ロジック
   (既存投影の取得 → 差分イベント再読 → `Account::apply` → create / link /
   Keto Owner / deactivate cascade / ban / suspend / update の分岐) を
   `application::projection::AccountProjector` へ機械的に移動する
   (この commit では Redis 駆動・SQL・分岐を一切変えない)。挙動変更
   (tailing 化・version gate・emit 削除) は後続 commit。
5. **同期書込みは残置**: コマンドパス内の同期 read model 書込み
   (`account/command.rs` の create、`account_detail/update.rs` の update) は
   本 Stage では維持する (read-after-write 挙動を変えないため)。projector の
   version-gated upsert はこれらと矛盾なく同居する (projector は常に
   `version <` ゲートで劣後し、同期書込みは常に最新 version)。同期書込みの
   削除は Stage 4 の UoW 移行で判断する。
6. **Keto**: projector の Keto Owner relation provisioning 判断は
   application::projection に残す (調停ロジック、決定6)。KetoClient の driver
   移動は Stage 4。
7. **ワーカー**: tailing worker は server が起動・shutdown を管理する (決定6)。
   現行 applier (rikka-mq fire-and-forget) には shutdown 管理がないため、
   新規 worker には CancellationToken 等の graceful stop を最低限付ける。
   poll interval は設定可能とし、既定は現行 Redis 経路と同程度の遅延
   (e2e が moderation 系の非同期投影に依存するため)。

## Scope

- 純粋 move commit (Stage 冒頭、独立コミット): AccountApplier の調停ロジックを
  `application::projection::AccountProjector` へ機械的移動 (挙動不変)
- migration: `projection_checkpoints` テーブル新設 + `account_events(seq)` index
- kernel: `AccountProjectionWriter` port (version-gated upsert。例:
  `INSERT ... ON CONFLICT (id) DO UPDATE ... WHERE <table>.version < EXCLUDED.version`
  / `UPDATE ... WHERE id = $1 AND version < $v`) と、checkpoint 読み書き・
  seq 窓読み出しを担う port 群を定義 (命名は実装で確定、closeout で writeback)
- driver (Postgres): 上記 port の実装。tail 読み出し → 投影書込み → checkpoint
  更新は同一 tx で行う
- `application::projection::AccountProjector`: 調停ロジック (fold、deactivate
  cascade、Keto Owner provisioning 判断)。per-aggregate version 順 fold
- server: tailing worker (poll 駆動、interval 設定可能、graceful shutdown 付き) を
  起動経路に追加
- adapter: `AccountCommandProcessor` からの emit 全 7 箇所削除、
  `AccountApplier` / `account_applier` Redis キュー削除、
  `DependOnAccountSignal` 配線の除去
- 冪等化: projector 経由の `accounts` 書込みを version-gated upsert に置換
- テスト: 冪等性 (再適用で不変・古い version は no-op)、コミット順序逆転での
  取りこぼしなし、per-aggregate 逆順到着の収束、move commit 前後で既存テスト緑

## Out of scope

- profile / metadata / auth_account の applier・emit (Redis 経路を維持。
  Stage 6 `auth-account-crud-migration` / Stage 7 `es-aggregates-migration`)
- ユースケース (Service) の UoW 移行・コマンドパス同期 read model 書込みの削除
  (Stage 4 `account-write-usecases`)
- append 側 CAS の原子性強化 (UNIQUE 制約・advisory lock。Stage 2 review の
  設計入力として Stage 4 で検証)
- `Signal` → `ProjectionNotifier`、`*ReadModel` → `*Query` + `*ProjectionWriter`
  の全面 rename (残り 3 集約の emit が残るため後続 Stage。本 Stage の rename は
  AccountApplier → AccountProjector の移動に限定)
- `outbox_activities` (ActivityPub 配送用) との統合 (決定4 で却下済み)
- `AccountStatus` の nullable カラム折り畳みのドメイン不変条件 API 化 (Stage 7)

## Verification

- `#[test_with::env(DATABASE_URL)]` (compose Postgres 16): 冪等性・コミット順序
  逆転・per-aggregate 逆順収束・checkpoint 進行の各テスト
- move commit と挙動変更 commit の分離を PR のコミット列で確認
  (move commit 単体でテスト緑)
- account 経路に Signal emit が残っていないことの grep 証跡
  (`adapter/src/processor/account/` に `.emit(` が 0 件)
- `cargo test` (DATABASE_URL あり) / clippy が緑
- e2e (compose) が緑 (poll interval が e2e 互換の遅延であること)
- `git diff --check`

## Knowledge Maintenance (G461, optional)

- Intent placement: ADR 0006 が source of truth (新規 intent ノード不要)
- ADR candidate: tailing プロトコルの確定 (窓パラメータ・checkpoint schema・
  seq index) を決定4 に、projector の確定配置 (module 構成・port 命名) を
  決定3/6/9 に追記 (closeout で処理)
- Diagram candidate: なし
- Docs update: なし (Emumet AGENTS.md Architecture 節の更新は移行完了後)
- Closeout learning: tailing プロトコル確定値と port/型の確定命名
  (write_back_required: true、ADR 0006 への追記)

- Guide reachability (G645): packet.yaml の guide_reachability を参照
  (no_role_facing_surface: true — 内部基盤のみの変更)

`improve` (G456 / G460) is the later safety net; packet-time maintenance is the normal path.
