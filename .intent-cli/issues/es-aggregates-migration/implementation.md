# es-aggregates-migration Implementation Packet

## Goal

ADR 0006 Stage 7。Profile / Metadata 集約を Account で確立した ES パターンに移行する。
書き込みを `AggregateRepository<Profile>` / `AggregateRepository<Metadata>` 経由に、
投影を Redis applier から checkpoint ベースの tailing projector
(ProfileProjector / MetadataProjector) に移し、Redis applier 経路を除去する。
併せて read query を projection DTO 返却に変更し (決定9)、seq index 追加と
e2e TRUNCATE への projection_checkpoints 追加を行う。

## Why

Account の投影は Stage 3 で tailing projector に一本化されたが、Profile / Metadata は
「event persist → Signal → Redis queue → applier が read model 更新」の旧経路に残っており、
投影の欠落保証が DB 行ではなく Redis 配信に委ねられている。read model がドメイン Entity を
そのまま返す点も決定9 未達成のまま。adapter 解体 (Stage 8) の前提でもある。

## 設計判断 (host 側で確定済み)

1. **AggregateRepository の適用**
   `AggregateRepository<Profile, Id = ProfileId>` / `AggregateRepository<Metadata,
   Id = MetadataId>` は素のまま適合する (両者とも EventApplier + CommandEnvelope)。
   `DependOnProfileRepository` / `DependOnMetadataRepository` を
   `DependOnAccountRepository` (kernel/src/repository/aggregate.rs:86-94) の先例で追加し、
   driver に Account と同形の実装を置く。adapter の command processor は調停
   (command 構築) のみとなり、`persist_and_transform` 直呼びを解消する
   (Account の Stage 4 と同じ整理)。

2. **projector の複製**
   `ProfileProjector` / `MetadataProjector` を `application::projection` に新設し、
   `ProjectAccountBatch` のプロトコル (checkpoint + WINDOW=100 の重複窓再読、
   BATCH_LIMIT=1000、per-aggregate version 順 fold、savepoint 隔離、
   version-gated upsert、checkpoint GREATEST 単調更新、全処理同一 tx) を踏襲する。
   projector_name は `profile_projector` / `metadata_projector`。
   driver には seq 窓読み出し (ProfileEventLog / MetadataEventLog 相当) と
   version-gated upsert writer を Account と同形で追加する。
   ProjectionWorker (server/src/projection_worker.rs) から両者を起動する。

3. **Redis applier 経路の除去**
   ProfileApplier / MetadataApplier、ApplierContainer の impl_signal! 登録、
   UpdateProfile / UpdateMetadata サービス、DependOnProfileSignal /
   DependOnMetadataSignal 配線 (handler.rs) を削除し、Profile/Metadata の
   直接 Signal emit を停止する。Account で Stage 3 が行ったことの横展開。

4. **同期 read model 書込みは維持**
   Account の先例 (決定9 Stage 3 確定: create / account_detail update の同期書込み維持)
   に従い、Profile create 等の同期書込みは残す。projector の version-gated upsert
   (`WHERE version < EXCLUDED.version`) により二重経路は冪等に収束する。

5. **削除済み Metadata のセマンティクス**
   `Metadata::Deleted` は fold 後に entity が None になるため、
   `AggregateRepository::load` は削除済みストリームでエラーになる
   (Rehydrated::from_events 起因)。この挙動を明示的に定義する:
   - projector は Deleted イベントで投影行を削除する (version gate 考慮)
   - command 側の再水和 (rehydrate_metadata 相当) は削除済みを NotFound として扱う
     現行挙動を維持する

6. **Profile::update の LWW 維持**
   `prev_version: None` (LWW) は現行セマンティクスのまま維持する。
   投影は version-gated upsert で保護される。変更する場合は PR description に根拠を記録。

7. **read query の DTO 化**
   ProfileReadModel / MetadataReadModel のクエリがドメイン Entity を返すのをやめ、
   ProfileDto / MetadataDto (または相当の投影型) を返す形にする。消費側は
   account_detail read/update、fields.rs (plan_field_updates)、GetActorUseCase。
   HTTP レスポンス形状は変更しない。transfer 層への配置は既存の
   application/src/transfer/ の規則に従う。

8. **migration / e2e 修正**
   `profile_events(seq)` / `metadata_events(seq)` に index 追加。
   e2e / test_mode の TRUNCATE リストに `projection_checkpoints` を追加する
   (現状は同期書込みが e2e を支えているが、projector 依存が増えるため
   checkpoint 残留で tailing が止まるのを防ぐ)。

## Scope

- AggregateRepository<Profile/Metadata> + DependOn* の追加と書き込み経路の移行
- ProfileProjector / MetadataProjector 新設 + driver の event log / upsert writer
- seq index migration + TRUNCATE リストへの projection_checkpoints 追加
- Redis applier 経路の除去 (applier / Update* サービス / Signal 配線)
- 削除済み Metadata セマンティクスの明示
- ProfileDto / MetadataDto による read query DTO 化と消費側更新
- projection tests への Profile / Metadata 追加

## Out of scope

- Account 側の残存同期書込み (command.rs:112-115) の除去
- route facade newtype 化・委譲マクロ集約・adapter クレート自体の削除 (Stage 8)
- Keto / 権限モデルの変更
- API レスポンス形状の変更
- Profile::update への楽観ロック導入
- WebFinger 等 Profile を使わない経路の変更

## Verification

- 等価性: e2e_basic_flow (create → PATCH display_name/summary/fields → GET) と
  AP actor e2e が同一挙動
- Profile/Metadata の projection テスト (冪等性・stale version no-op・checkpoint 前進・
  Deleted の行削除)
- 残存参照ゼロ: ProfileApplier / MetadataApplier / UpdateProfile / UpdateMetadata /
  DependOnProfileSignal / DependOnMetadataSignal / profile_applier / metadata_applier
  を grep で確認
- Profile/Metadata の read model port がドメイン Entity を返さないこと (型で確認)
- `cargo test` (DATABASE_URL あり) / clippy / fmt / e2e green
- `git diff --check` clean

## Knowledge Maintenance (G461, optional)

- Intent placement: `intents/emumet/decisions/0006-architecture-realignment-transaction-projection.md`
- ADR candidate: yes — Stage 7 確定値を決定3/6/9 に writeback
- Diagram candidate: none
- Docs update: none
- Closeout learning: repository DI 形状、projector 配置と checkpoint 名、Deleted
  セマンティクス、LWW 維持の是非、DTO 形状 (write_back_required: true)
- Guide reachability (G645): `no_role_facing_surface: true`

`improve` (G456 / G460) is the later safety net; packet-time maintenance is the normal path.
