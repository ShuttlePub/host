# emumet — packet backlog (2026-07-22 stack)

intent interview (../interview/2026-07-22-initial-shaping.md) と実装インベントリに基づく
順序付き backlog。packet 実体は `.intent-cli/issues/<unit>/`。

## Ready(切り出し可能)

| # | execution unit | 概要 | 依存 |
|---|---|---|---|
| 1 | `architecture-foundation` | ADR 0006 Stage 1。characterization tests、no-op `Executor::commit` 廃止、`TransactionManager` port + signature spike (AsyncFnOnce vs Box::pin)、event テーブル seq 列追加 | — |
| 2 | `account-aggregate-repository` | ADR 0006 Stage 2。`AccountRepository` port (`Rehydrated<Account>`) + driver 実装、旧 CommandProcessor との同値テストで並走 | 1 |
| 3 | `projection-outbox-projector` | ADR 0006 Stage 3。event + 通知の同一 tx 化 (log tailing)、Account projector を application::projection に新設、直接 Signal emit 停止、applier 冪等化 (version-gated upsert) | 1, 2 |
| 4 | `account-write-usecases` | ADR 0006 Stage 4。CreateAccount / UpdateAccountDetail / moderation を UoW に移行、SigningKey の executor 受け取り化、Keto post-commit provisioning (KetoClient は driver へ移動) | 2, 3 | — issue [#30](https://github.com/ShuttlePub/Emumet/issues/30) / PR [#31](https://github.com/ShuttlePub/Emumet/pull/31) マージ済み |
| 5 | `crud-ap-transactions` | ADR 0006 Stage 5。Block / Inbox Follow / Inbox Block を tx + 配送 outbox 化、Mute / Accept / Undo 系は冪等 repo 操作 (`insert_if_absent` 等) に置換 | 1 |
| 6 | `auth-account-crud-migration` | ADR 0006 Stage 6。AuthAccount を ES→CRUD 移行、find-or-create を `ON CONFLICT (host_id, client_id)` 原子化、同期 projection 例外除去、auth_account_events データ移行 | 1 |
| 7 | `es-aggregates-migration` | ADR 0006 Stage 7。Profile / Metadata を ES repository/projector パターンに移行、`AccountProjection` の横展開 (新規 read query はドメイン Entity を返さない) | 2-4 |
| 8 | `di-cleanup-adapter-removal` | ADR 0006 Stage 8。route facade newtype 化 (生 port/executor アクセス遮断)、委譲マクロ集約、adapter クレート削除 (参照ゼロ後) | 2-7 |
| 9 | `moderation-role-assignment` | Admin/Moderator ロール割当管理 API | — |
| 10 | `moderation-account-report` | 通報(AccountReport)機能。Ratcap admin-moderation と横断設計 | 9 |
| 11 | `mastodon-e2e-undo-coverage` | Mastodon 実機 E2E に Undo(Follow) 相互運用シナリオを追加(unfollow-api の Undo 配送を実 Mastodon 相手に検証。S7-S9 は完成済み) (2026-08-12 C4 grill より) | — |
| 12 | `media-upload` | 画像アップロード API + S3 互換ストレージ (開発: RustFS) + Actor icon/image 反映 + Update 配送 (2026-08-12 C1 grill でブロッカー解消、packet draft 済み) | — |

1-8 は [../decisions/0006-architecture-realignment-transaction-projection.md](../decisions/0006-architecture-realignment-transaction-projection.md)
(2026-08-13 Accepted) に由来するアーキテクチャ再配置ユニット。
atomicity 欠落が現在進行形のデータ不整合リスクのため先頭に配置。
packet 起こしは `architecture-foundation` から。
命名の正規化 (ADR §10) は各 Stage 冒頭の純粋 rename commit として実施する。

## 完了

- `account-aggregate-repository` — issue #26 / PR #27 マージ済み(2026-08-13、
  merge commit d064264)。ADR 0006 Stage 2。AggregateRepository port
  (`save(CommandEnvelope)` 確定) + `Rehydrated<A>` + Postgres 実装 + 新旧同値テスト。
  確定 signature と Stage 3/4 への設計入力 (CAS 原子性・version 連鎖・tailing 順序分離) は
  ADR 0006 決定3/9 に writeback 済み
- `architecture-foundation` — issue #24 / PR #25 マージ済み(2026-08-13)。ADR 0006 Stage 1。
  TransactionManager port (Box::pin closure 版)・no-op commit 廃止・event seq 列追加
- `projection-outbox-projector` — issue #28 / PR #29 マージ済み(2026-08-14)。ADR 0006 Stage 3。
  account_events log tailing (checkpoint + 重複窓再読) + `application::projection::AccountProjector` 新設 +
  直接 Signal emit 停止 + `AccountApplier` / `account_applier` キュー廃止。確定 tailing プロトコルと
  projector 配置は ADR 0006 決定3/4/6/9 に writeback 済み
- `block-mute-federation` — issue #22 / PR #23 マージ済み(2026-08-13)。
  block-mute feature の acceptance 全項目達成。レビュー観測のフォローアップ候補
  (重複 Block 時の follow 再解除・inbox エラーパス単体テスト拡充・S10 の Undo 受信検証) は
  [../features/block-mute/decisions.md](../features/block-mute/decisions.md) に記録
- `unfollow-api` — issue #20 / PR #21 マージ済み(2026-08-12)
- `account-write-usecases` — issue #30 / PR #31 マージ済み(2026-08-14)。ADR 0006 Stage 4。
  CreateAccount / UpdateAccountDetail / moderation (suspend/unsuspend/ban/deactivate) の UoW 化、
  `AggregateRepository<Account>` のユースケース層本採用、SigningKey executor 受け渡し、
  Keto post-commit provisioning (冪等 create/delete)。`unban` / `reactivate` は未実装のまま。
  確定 design (DependOnTransactionManager 注入形状・post-commit provisioning パターン・
  UoW 内 version 連鎈) は ADR 0006 決定2/3/5 に writeback 済み
- `crud-ap-transactions` — issue #32 / PR #33 マージ済み(2026-08-14)。ADR 0006 Stage 5。
  Block / Unblock / Inbox Follow / Inbox Block / Undo(Block) の UoW 化、AP 配送 outbox 化
  (`outbox_activities` に `delivered_at` / `attempted_at` / `error` 列追加、commit 後 delivery)、
  Mute / Accept / Undo Follow / Undo Block の冪等 repo 操作化 (`insert_if_absent` /
  `approve_follow_if_pending` / `delete_if_exists`)。確定 design は ADR 0006 決定2/3/4/5 に
  writeback 済み
- `mastodon-e2e-completion` — S7-S9 シナリオ完成、CI (e2e.yml → run-ap-e2e.sh) で
  実 Mastodon コンテナ相手に常時実行中。backlog 記述が stale だっただけで実体は達成済み

## Deferred(open question 解消が先)

| feature | ブロッカー |
|---|---|
| post-relay | ShuttlePub への転送プロトコル、サービス間認証。**再開条件: ShuttlePub 本体実装の構想が立つこと** (2026-08-12 grill) |
| shuttlepub-link | 連携先との認証方式、ShuttlePub 本体側の実装状況。**再開条件: 同上 (C2 と同時)** (2026-08-12 grill) |

## Host-only(publish 対象外)

- docs 同期: ShuttlePub/document の data-structure.md が実装より古い
  (Moderation「未実装」記載、StellarAccount の再解釈)。Emumet issue ではなく
  document リポジトリ側で対応する。

## 運用メモ

- 一度に publish するのは先頭 1 件のみ(stack のデフォルト境界)。
- 各 packet 完了時に対応する features/*/packets.md へ issue リンクを追記する
  (各 packet の knowledge_updates.intent_tree 参照)。
