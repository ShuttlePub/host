## Goal

ADR 0006 Stage 7. Profile / Metadata 集約を、Account に対して Stage 2/3/4 で確立した
ES パターンに移行する。

具体的には: 書き込み経路を `AggregateRepository<Profile>` / `AggregateRepository<Metadata>`
経由に置き換え、投影を Redis applier (Signal → UpdateProfile/UpdateMetadata) から
checkpoint ベースの tailing projector (ProfileProjector / MetadataProjector) に移し、
Redis applier 経路を除去する。併せて Profile / Metadata の read query を
projection DTO 返却に変更し (決定9 の「新規 read query はドメイン Entity を返さない」)、
seq index 追加と e2e TRUNCATE への projection_checkpoints 追加を行う。

## Why This Slice Exists Now

Stage 3 で Account の投影は tailing projector に一本化され、直接 Signal emit は
Account については廃止済み。しかし Profile / Metadata は引き続き
「event persist → Signal → Redis queue → applier が read model 更新」という
旧経路に依存しており、投影の欠落保証が Redis 配信に委ねられている
(DB 行ではなく通知が保証の起点)。また read model がドメイン Entity をそのまま返すため、
決定9 の domain/projection 分離が Profile/Metadata では未達成。
adapter クレート解体 (Stage 8) の前提でもある。

## Current Observed State

- Profile (`kernel/src/entity/profile.rs`): イベントは Created / Updated。
  create は `ExpectedVersion::Nothing`、update は LWW (ExpectedVersion なし)。
  Metadata (`kernel/src/entity/metadata.rs`): Created / Updated / Deleted。
  update/delete は `At(current_version)`。Deleted は fold 後に entity が None になる。
- 書き込み: Profile create は `persist_and_transform` + 同期 read model create +
  Signal emit (`adapter/src/processor/profile.rs:71-113`)。Profile update と
  Metadata の全コマンドは persist + Signal のみ (`adapter/src/processor/metadata.rs`)。
  Account は既に `AggregateRepository` + UoW 化済み (`account_detail/update.rs:82-108`)。
- 投影: `ProfileApplier` / `MetadataApplier` (server/src/applier/) が Redis queue
  `profile_applier` / `metadata_applier` を消費し、`UpdateProfile` / `UpdateMetadata`
  (application/src/service/) で read model を更新。配線は `impl_signal!` +
  `DependOnProfileSignal` / `DependOnMetadataSignal` (server/src/handler.rs)。
- 読み取り: `ProfileReadModel` / `MetadataReadModel` のクエリはドメイン Entity を返す。
  `ProfileDto` / `MetadataDto` は未存在。消費側は account_detail read/update、
  fields.rs (`plan_field_updates`)、`GetActorUseCase` (AP Actor 直列化)。
- スキーマ: `profile_events` / `metadata_events` に `seq BIGSERIAL` は追加済み
  (20260813000001) だが seq index なし。`projection_checkpoints` テーブルあり。
- テンプレート: `ProjectAccountBatch` (checkpoint + 重複窓再読 WINDOW=100 /
  BATCH_LIMIT=1000、per-aggregate version 順 fold、savepoint 隔離、
  version-gated upsert、同一 tx) と `ProjectionWorker` (100ms poll) が実証済み。
- 既知のシーム: e2e / test_mode の TRUNCATE リストに `projection_checkpoints` が
  含まれていない (現状は Account/Profile create の同期書込みが e2e を支えている)。
- 削除済み Metadata はストリームが None に fold されるため `repository.load` が
  エラーになる。現行 `rehydrate_metadata` は NotFound を返す。

## Accepted Baseline You May Assume

- ADR 0006 全体 (決定3: 4系統の port 文法、決定4: projection 通知は log tailing、
  決定6: projector の配置、決定9: domain/projection 分離と「新規 read query は
  ドメイン Entity を返さない」)。
- Stage 1-6 完了済み (PR #25 / #27 / #29 / #31 / #33 / #35 マージ済み)。
  `AggregateRepository<A>` port と `DependOnAccountRepository` の DI 形状、
  `ProjectAccountBatch` の tailing プロトコル、version-gated upsert は確定済み。
- コマンドパスの同期 read model 書込みは Account で維持されている
  (決定9 Stage 3 確定)。Profile/Metadata もこの先例に従う。
- rust-toolchain は 1.97.0。DB テストは `#[test_with::env(DATABASE_URL)]` で
  Postgres 16 相手に実行。
- 移行と挙動変更は別 commit に分離する (ADR §10)。parallel change を徹底し
  main green を維持する。

## Target Repo / Path / Part

Repository: `ShuttlePub/Emumet`

Target paths: `kernel/src/entity/profile.rs, kernel/src/entity/metadata.rs, kernel/src/repository/aggregate.rs, kernel/src/repository/, kernel/src/read_model/profile.rs, kernel/src/read_model/metadata.rs, kernel/src/projection.rs, kernel/src/lib.rs, adapter/src/processor/profile.rs, adapter/src/processor/metadata.rs, application/src/projection/, application/src/service/profile.rs, application/src/service/metadata.rs, application/src/service/account_detail/, application/src/service/activitypub/actor.rs, application/src/transfer/, driver/src/database/postgres/projection.rs, driver/src/database/postgres/profile.rs, driver/src/database/postgres/metadata.rs, server/src/applier.rs, server/src/applier/profile_applier.rs, server/src/applier/metadata_applier.rs, server/src/handler.rs, server/src/projection_worker.rs, server/src/route/test_mode.rs, server/tests/support/db.rs, migrations/`

Target part: Profile / Metadata の書き込みを AggregateRepository 経由に、投影を tailing projector に移行し、Redis applier 経路を除去。read query を DTO 返却に変更

## In Scope

- `AggregateRepository<Profile>` / `AggregateRepository<Metadata>` の採用
  (`DependOnProfileRepository` / `DependOnMetadataRepository` を `DependOnAccountRepository`
  の先例で追加)。adapter の command processor は調停 (command 構築) のみに整理し、
  event store の `persist_and_transform` 直呼びを解消。
- `ProfileProjector` / `MetadataProjector` を `application::projection` に新設。
  `ProjectAccountBatch` と同じ tailing プロトコル (checkpoint + 重複窓再読、
  per-aggregate version 順 fold、version-gated upsert、savepoint 隔離、同一 tx)。
  projector_name は `profile_projector` / `metadata_projector`。ProjectionWorker から起動。
- driver に Profile/Metadata 用の event log 読み出し (seq 窓) と version-gated upsert
  (ProfileProjectionWriter / MetadataProjectionWriter 相当) を追加。
- migration: `profile_events(seq)` / `metadata_events(seq)` に index 追加。
  e2e / test_mode の TRUNCATE リストに `projection_checkpoints` を追加。
- Redis applier 経路の除去: ProfileApplier / MetadataApplier、対応する
  `impl_signal!` 登録、`UpdateProfile` / `UpdateMetadata` サービス、
  `DependOnProfileSignal` / `DependOnMetadataSignal` 配線の削除。
  Profile/Metadata の直接 Signal emit 停止。
- コマンドパスの同期 read model 書込みは Account 先例に従い維持
  (projector の version-gated upsert と冪等に両立させる)。
- 削除済み Metadata のセマンティクス明示: projector は Deleted で投影行を削除。
  command 側の再水和は削除済みストリームを NotFound として扱う現行挙動を維持。
- Profile::update の LWW は現行維持 (変更する場合は PR description に根拠を記録)。
- read query の DTO 化: ProfileDto / MetadataDto (または相当の投影型) を定義し、
  account_detail read/update、fields.rs、activitypub/actor.rs の消費側を更新。
  read model port はドメイン Entity を返さない形にする。
- projection tests に Profile / Metadata のテスト追加 (冪等性、古い version の
  no-op、checkpoint 前進、Deleted の投影削除)。

## Out Of Scope

- Account 側の残存同期書込み (adapter/src/processor/account/command.rs:112-115) の除去。
- route facade newtype 化・委譲マクロ集約・adapter クレート自体の削除 (Stage 8)。
- Keto / 権限モデルの変更 (Profile/Metadata 固有の relation は存在しない)。
- API レスポンス形状の変更 (DTO 化は内部の型のみ。HTTP レスポンスは同一であること)。
- Profile::update への楽観ロック導入 (LWW 維持がデフォルト)。
- WebFinger など Profile を使わない読み取り経路の変更。

## Standalone Child Issue Contract

This issue asks the child implementation repo to migrate the Profile and Metadata
aggregates to the ES repository + tailing projector pattern established for Account:
route all writes through `AggregateRepository<Profile>` / `AggregateRepository<Metadata>`
(command processors keep only mediation), add `ProfileProjector` / `MetadataProjector`
to `application::projection` using the proven checkpoint + windowed-re-read tailing
protocol with version-gated upserts, remove the Redis applier path (appliers,
Update* services, Signal wiring), keep the command-path synchronous read-model writes
per the Account precedent, define deleted-Metadata semantics explicitly (projector
deletes the projection row; command-side rehydration keeps returning NotFound), change
Profile/Metadata read queries to return projection DTOs instead of domain entities,
and add seq indexes plus `projection_checkpoints` to the e2e/test-mode TRUNCATE lists.
Tests must stay green and `main` must remain green.

## Acceptance Criteria

- Profile / Metadata writes go through `AggregateRepository<Profile>` /
  `AggregateRepository<Metadata>` (`DependOnProfileRepository` /
  `DependOnMetadataRepository`). The adapter command processors no longer call the
  event store's `persist_and_transform` directly.
- `ProfileProjector` / `MetadataProjector` exist in `application::projection` and run
  the same tailing protocol as `ProjectAccountBatch` (checkpoint + windowed re-read,
  per-aggregate version-ordered fold, version-gated upsert, savepoint isolation, single
  tx). They are registered with the ProjectionWorker under distinct projector names.
- A migration adds indexes on `profile_events(seq)` and `metadata_events(seq)`, and
  `projection_checkpoints` is added to the TRUNCATE lists in `server/tests/support/db.rs`
  and `server/src/route/test_mode.rs`.
- The Redis applier path is removed: `ProfileApplier` / `MetadataApplier`, their
  `impl_signal!` registrations, `UpdateProfile` / `UpdateMetadata` services, and the
  `DependOnProfileSignal` / `DependOnMetadataSignal` wiring are deleted. No direct
  Signal emit remains for Profile/Metadata.
- Command-path synchronous read-model writes are preserved (Account precedent) and
  coexist idempotently with the projector's version-gated upserts.
- Deleted Metadata semantics are explicit: the projector deletes the projection row on
  `Deleted`; command-side rehydration keeps treating deleted streams as NotFound.
- `Profile::update` keeps LWW semantics (no ExpectedVersion), unless the PR description
  records a reasoned change.
- Profile / Metadata read queries return projection DTOs, not domain entities; the
  consumers (account_detail read/update, fields.rs, activitypub/actor.rs) are updated.
  HTTP response shapes are unchanged.
- Projection tests cover Profile / Metadata (idempotency, stale-version no-op,
  checkpoint advance, Deleted row removal). Characterization tests and e2e
  (including e2e_basic_flow PATCH / fields replacement) stay green.
- `cargo test` (with `DATABASE_URL`) / clippy / fmt are green; e2e (compose) is green.

## Verification

- Equivalence: e2e_basic_flow (create → PATCH display_name/summary/fields → GET) and
  the AP actor e2e behave identically before/after.
- New projection tests for Profile/Metadata mirroring the Account projector tests.
- Grep: no remaining references to `ProfileApplier`, `MetadataApplier`,
  `UpdateProfile`, `UpdateMetadata`, `DependOnProfileSignal`, `DependOnMetadataSignal`,
  `profile_applier`, `metadata_applier` outside historical migrations/docs.
- Read model ports for Profile/Metadata no longer return domain entities (type check).
- `git diff --check` clean.

## Related Links

- ADR 0006: `intents/emumet/decisions/0006-architecture-realignment-transaction-projection.md`
  (決定3 / 決定4 / 決定6 / 決定9)
- Backlog: `intents/emumet/packets/backlog.md`
- Stage 2 PR #27: https://github.com/ShuttlePub/Emumet/pull/27
- Stage 3 PR #29: https://github.com/ShuttlePub/Emumet/pull/29
- Stage 4 PR #31: https://github.com/ShuttlePub/Emumet/pull/31
- Stage 6 PR #35: https://github.com/ShuttlePub/Emumet/pull/35

## Knowledge Maintenance

- Intent placement: `intents/emumet/decisions/0006-architecture-realignment-transaction-projection.md`
- ADR candidate: yes — record Stage 7 final values (repository DI shape, projector
  placement/names, deleted-Metadata semantics, LWW decision, DTO shapes) in ADR 0006
  decisions 3/6/9.
- Diagram candidate: none
- Docs update: none
- Closeout writeback expected: yes

## Guide Reachability

No role-facing surface is added. HTTP routes and response shapes remain unchanged;
this slice changes internal write/projection/read-model structure only.

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open all child PRs against `main` directly.
