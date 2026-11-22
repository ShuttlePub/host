# emumet — packet backlog (2026-07-22 stack)

intent interview (../interview/2026-07-22-initial-shaping.md) と実装インベントリに基づく
順序付き backlog。packet 実体は `.intent-cli/issues/<unit>/`。

**2026-08-29 追記**: 下の旧 Ready テーブル (#1-#12) は 2026-08-29 時点で全て
完了済み (各 packet の issue/PR は完了セクションに記録。GitHub open issue なし)。
新規の Ready backlog はこの追記以降のセクションを参照。

## Ready (2026-08-29 stack 追加)

org-accounts (C5 解消、2026-08-29 grill Q1-Q11 確定) の packet 群。
設計の正源: ../features/org-accounts/overview.md「確定設計」、
../interview/2026-08-29-org-accounts-grill.md。

| # | execution unit | 概要 | 依存 |
|---|---|---|---|
| W1 | `org-accounts-foundation` | Account 種別 (personal/organization) + 組織作成 (作成者=最初のオーナー) + メンバーシップ (Owner/Admin/Member) CRUD + 招待/承認 + 所属組織一覧 | — |
| W2 | `org-accounts-auth-context` | スイッチ式認証: 個人 identity のまま組織コンテキスト指定 (仮: ヘッダ)、メンバーロール判定 + コンテキスト付き主体解決、組織コンテキストでの Profile 操作 | W1 |
| W3 | `profile-transfer` | Profile 移管 2段階フロー (申請→承認/却下/取消)、所有移転 (account_id 付け替え) + イベント、参照ファイルコピー要求の port (Booskiff 連携は stub) | W1 |
| W4 | `moderation-warning-event` | AccountEvent::Warning 新設 + 通報 resolve 時の「警告で解決」 (warned resolution) + 警告履歴 admin 参照 | — |

packet 化の未対象スコープ (将来): リモートメンバー加入、移管の戻し、
組織の課金、AP 上の組織 actor 型。

## Ready(切り出し可能) — 旧テーブル (全て完了済み、2026-08-29 確認)

| # | execution unit | 概要 | 依存 |
|---|---|---|---|
| 1 | `architecture-foundation` | ADR 0006 Stage 1。characterization tests、no-op `Executor::commit` 廃止、`TransactionManager` port + signature spike (AsyncFnOnce vs Box::pin)、event テーブル seq 列追加 | — |
| 2 | `account-aggregate-repository` | ADR 0006 Stage 2。`AccountRepository` port (`Rehydrated<Account>`) + driver 実装、旧 CommandProcessor との同値テストで並走 | 1 |
| 3 | `projection-outbox-projector` | ADR 0006 Stage 3。event + 通知の同一 tx 化 (log tailing)、Account projector を application::projection に新設、直接 Signal emit 停止、applier 冪等化 (version-gated upsert) | 1, 2 |
| 4 | `account-write-usecases` | ADR 0006 Stage 4。CreateAccount / UpdateAccountDetail / moderation を UoW に移行、SigningKey の executor 受け取り化、Keto post-commit provisioning (KetoClient は driver へ移動) | 2, 3 | — issue [#30](https://github.com/ShuttlePub/Emumet/issues/30) / PR [#31](https://github.com/ShuttlePub/Emumet/pull/31) マージ済み |
| 5 | ~~`crud-ap-transactions`~~ → `crud-ap-transactions-reapply` — 完了 (issue #41 / PR #42 merge 2026-08-16) | ADR 0006 Stage 9 (Stage 5 re-apply / recovery)。Stage 5 (issue #32 / PR #33) は draft のまま closeout 記録されコード未マージ。PR #33 は superseded close 済み (2026-08-16)。Stage 5 の intent を現行 main (Stage 6-8 適用後) に再適用 | 1 |
| 6 | `auth-account-crud-migration` | ADR 0006 Stage 6。AuthAccount を ES→CRUD 移行、find-or-create を `ON CONFLICT (host_id, client_id)` 原子化、同期 projection 例外除去、auth_account_events データ移行 | 1 |
| 7 | `es-aggregates-migration` | ADR 0006 Stage 7。Profile / Metadata を ES repository/projector パターンに移行、`AccountProjection` の横展開 (新規 read query はドメイン Entity を返さない) | 2-4 |
| 8 | `di-cleanup-adapter-removal` — 完了 (issue #39 / PR #40 merge 2026-08-15) | ADR 0006 Stage 8 (最終)。adapter crate 解体・削除、kernel `*Query` facade (read_model 配下)、command 調停の use case inline 化 (Param 6型廃止)、crypto の kernel::interfaces::crypto 移動、server/src/api facade 6種 (DependOn* 非実装・FromRef<AppModule>)、`impl_database_delegation!` に5 trait 追加 + AppModule/Handler 二重委譲解消、`transfer`→`dto` rename + `Signal` trait 削除。確定値は ADR 0006 決定7/10 に writeback 済み | 2-7 |
| 9 | `moderation-role-assignment` — 完了 (issue #45 / PR [#48](https://github.com/ShuttlePub/Emumet/pull/48) merge 2026-08-21) | Admin/Moderator ロール割当管理 API。Keto `administrate` permit 新設 (admins のみ)、自己 Admin 剥奪拒否 (decisions.md D1/D2) | — |
| 10 | `moderation-account-report` — 完了 (issue #53 / PR [#54](https://github.com/ShuttlePub/Emumet/pull/54) merge 2026-08-23) | 通報(AccountReport)機能。ローカルアカウントのみ・3状態(open/resolved/dismissed)・ES aggregate・instance_moderate 流用。Ratcap admin-moderation は publish 可能 | 9 |
| 12 | `media-upload` — 完了 (issue #43 / PR [#44](https://github.com/ShuttlePub/Emumet/pull/44) merge 2026-08-19) | 画像アップロード API + S3 互換ストレージ (開発: RustFS) + Actor icon/image 反映 + Update 配送 (2026-08-12 C1 grill でブロッカー解消、packet draft 済み) | — |

1-8 は [../decisions/0006-architecture-realignment-transaction-projection.md](../decisions/0006-architecture-realignment-transaction-projection.md)
(2026-08-13 Accepted) に由来するアーキテクチャ再配置ユニット。
atomicity 欠落が現在進行形のデータ不整合リスクのため先頭に配置。
packet 起こしは `architecture-foundation` から。
命名の正規化 (ADR §10) は各 Stage 冒頭の純粋 rename commit として実施する。

## 完了

- `moderation-account-report` — issue #53 / PR #54 マージ済み(2026-08-23、
  merge commit 48422b0)。通報(AccountReport)機能: 作成 client API
  (ローカルアカウント限定、category [spam|harassment|other] + comment、other 時 comment
  必須) + モデレーターハンドリング admin API (一覧 + resolve/dismiss、close_reason 必須、
  二重クローズは Rejected)。ES aggregate (account_report_created /
  account_report_closed) + tailing projector + ReportProjection。認可は
  instance_moderate 流用。設計: features/moderation/decisions.md D4
  (2026-08-23 横断 grill)
- `block-mute-followups` — issue #51 / PR #52 マージ済み(2026-08-22、
  merge commit ffb87d8)。PR #23 レビュー観測 3 件の消化:
  重複 inbox Block no-op の実 DB 固定 (`inbox_block_duplicate_does_not_re_run_follow_removal`、
  first-delivery ガード `if inserted` の mutation 感度 RED/GREEN 確認済み)・
  inbox Block/Undo(Block) エラーパス単体テスト 4 件 (他人 inbox Rejected /
  object 非 actor id Rejected / Undo 非 Block Rejected / unknown remote actor Ok)・
  Iceshrimp E2E S10 の Undo(Block) 相手側観測 (users/show isBlocked true→false 遷移を
  `wait_for_iceshrimp_block_present/absent` で固定)。本番コード挙動変更なし (テスト強化スライス)。
  CI e2e 含め全緑
- `account-unban-reactivate` — issue #49 / PR #50 マージ済み(2026-08-22、
  merge commit 0eade33)。unban (Banned→Active) admin API + reactivate
  (deactivated 復帰) client API + AccountEvent::Unbanned/Reactivated。
  レビューで受領した設計判断2件: (a) projector の deactivation cascade から
  `unlink_all_auth_accounts` を除去 (packet 前提「紐付けは削除されない」が現行コードと
  矛盾しており、このままでは reactivate が恒常 403 になるため。regression test
  `projected_deactivation_preserves_auth_account_linkage` で固定)、
  (b) Rejected の HTTP mapping は既存共有 ErrorStatus マッピングの 422 を維持
  (packet の 400 記載は「既存 admin ルート準拠」の原則に従い不採用)。
  引き継ぎ事項: 本修正以前に unlink 済みの deactivated account は復帰不可。
  救済が必要なら Created event からの backfill を別途判断 → 本番未稼働で救う対象の実データがないため救済しない ([shuttlepub D60](../../shuttlepub/decisions/2026-11-21-emumet-p1-open-items.md))
- `media-upload` — issue #43 / PR #44 マージ済み(2026-08-19)。画像アップロード API +
  S3 互換ストレージ連携 (開発: RustFS) + Actor icon/image 反映 + Update(Person) 配送。
  knowledge writeback は required:false のため本 backlog への反映のみ

- `mastodon-e2e-undo-coverage` — issue #46 / PR #47 マージ済み(2026-08-20、
  merge commit 91faa72)。Mastodon 実機 E2E (`mastodon_full_federation_scenario`) に
  S10 (双方向 Undo(Follow)) を追加。Emumet→Mastodon (unfollow REST → 相手 followers
  から消失) / Mastodon→Emumet (Mastodon REST unfollow → inbox Undo(Follow) 処理) の
  両方向をポーリングで外部観測アサート。`MastodonClient::unfollow_account` /
  `wait_for_mastodon_followers_absent` / `wait_for_mastodon_following_absent` /
  `wait_for_emumet_collection_count_at_most` ヘルパー整備。本体コード diff なし
  (テストのみのスライス)。2026-08-12 C4 grill の残余ギャップを解消

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
- `crud-ap-transactions` — **記録訂正 (2026-08-16)**: issue #32 / PR #33 は「マージ済み」ではない。
  PR #33 が draft のまま closeout 記録され (loop notes の既知の落とし穴)、コードは main に
  一度もマージされなかった。PR #33 は Stage 6-8 とのコンフリクトにより superseded close。
  下記の設計内容 (UoW 化・配送 outbox 化・冪等 repo 操作化) は **設計入力として有効** だが、
  実装は `crud-ap-transactions-reapply` (ADR 0006 Stage 9) で現行 main に再適用する。
  ~~issue #32 / PR #33 マージ済み(2026-08-14)。ADR 0006 Stage 5。~~
  Block / Unblock / Inbox Follow / Inbox Block / Undo(Block) の UoW 化、AP 配送 outbox 化
  (`outbox_activities` に `delivered_at` / `attempted_at` / `error` 列追加、commit 後 delivery)、
  Mute / Accept / Undo Follow / Undo Block の冪等 repo 操作化 (`insert_if_absent` /
  `approve_follow_if_pending` / `delete_if_exists`)。確定 design は ADR 0006 決定2/3/4/5 に
   writeback 済み (根拠表記は修正済み — ADR 側の注記を参照)
- `crud-ap-transactions-reapply` — issue #41 / PR #42 マージ済み(2026-08-16, merge 8b21711)。
  ADR 0006 Stage 9 (Stage 5 re-apply / recovery)。Stage 5 の intent を現行 main に再適用:
  Block/Unblock + inbox Follow/Block/Undo(Block) の UoW 化 + post-commit 配送、
  Mute/Accept/Undo Follow/Undo Block の冪等 repo 操作化、
  `outbox_activities` への delivery state カラム追加。確定値は ADR 0006 決定2 に
  Stage 9 確定として writeback 済み
- `auth-account-crud-migration` — issue #34 / PR #35 マージ済み(2026-08-15)。ADR 0006 Stage 6。
  AuthAccount ES→CRUD 移行: `AuthAccountRepository` CRUD port 新設
  (`find_or_create` = `INSERT ... ON CONFLICT (host_id, client_id) DO NOTHING RETURNING` +
  fallback SELECT)、同期 projection 例外と Redis リペア経路 (`UpdateAuthAccount` /
  `auth_account_applier` queue) 除去、ES 基盤削除、`auth_account_events` の backfill +
  drop マイグレーション (version 列は backfill 前に drop)。確定値は ADR 0006 決定8/9/10 に
  writeback 済み。なお Stage 6 作業中に e2e harness の TRUNCATE が projection worker と
  deadlock する既知 flake (Stage 3 由来) が顕在化し、test-support の retry 修正を
  PR #36 として別途マージ済み (operator 承認の単発 PR)
- `mastodon-e2e-completion` — S7-S9 シナリオ完成、CI (e2e.yml → run-ap-e2e.sh) で
  実 Mastodon コンテナ相手に常時実行中。backlog 記述が stale だっただけで実体は達成済み
- `es-aggregates-migration` — issue #37 / PR #38 マージ済み(2026-08-15)。ADR 0006 Stage 7。
  Profile/Metadata を `AggregateRepository` 経由の書き込み + tailing projector
  (ProfileProjector/MetadataProjector) に移行、Redis applier 経路全削除、
  read query の projection DTO 化 (ProfileProjection/MetadataProjection)、
  削除済み Metadata の NotFound 化 (`from_events_allow_deletion`)、cross-projector
  規約 (削除済み親 Account の fresh materialization skip) を確立。seq index 追加 +
  e2e TRUNCATE に projection_checkpoints 追加。確定値は ADR 0006 決定3/6/9 に writeback 済み

## 候補（P1 の後で検討）

### `account-deactivation-grace-and-purge`

- **状態**: 候補（P1 の後で検討）
- **出どころ・提案（ユーザー）**: 退会直後は物理削除せず論理削除にし、約 1 か月の猶予期間後にバッチで物理削除する。
- **現状（Emumet main `1259c731` の調査）**:
  - `DELETE /api/v1/accounts/{account_id}` は `Deactivated` イベントを保存する（`server/src/route/account/client.rs:295-328`、`application/src/service/account/deactivate.rs:35-68`）。
  - Account projector は猶予なしに Profile と Metadata の read model 行を削除する（`application/src/projection/account_projector.rs:154-175`）。Profile 行の削除に伴い `profile_follows` / `profile_blocks` / `profile_mutes` / `profile_delivery_jobs` なども `ON DELETE CASCADE` で消え、reactivate しても戻らない（`docs/profile-federation-cutover.md:26`、`account_projector.rs:176-194`）。
  - 残るものは、イベント履歴、`profile_signing_keys`（FK を外して Profile 行の削除後も保持、`migrations/20261121000001_profile_signing_keys_survive_deactivation.sql:1-14`）、`auth_emumet_accounts` の紐付け（`account_projector.rs:195-196`）、`deleted_at` 付きの Account 行（`account_projector.rs:154-157`）。イベント履歴の保持は `intents/emumet/decisions/profile-federation-in-place-reset.md:86` にも記録されている。
  - `POST /api/v1/accounts/{id}/reactivate` に期限判定はなく、削除済み Account を取得して `deleted_at` の有無だけを検査する（`application/src/service/account/reactivate.rs:33-75`）。Profile はイベント履歴全体から再 materialize される（`application/src/projection/account_projector.rs:202-208,272-300`）。
  - 猶予期限後の purge バッチや恒久削除経路は確認できない（Profile の恒久削除経路には明示的な鍵削除が必要: `intents/emumet/decisions/profile-federation-in-place-reset.md:89,104`、`intents/emumet/decisions/profile-actor-identity.md:50`）。退会中の actor と WebFinger は 404（`server/src/route/activitypub/profile_actor.rs:34-40,60-71`、`intents/emumet/decisions/profile-federation-in-place-reset.md:90`）。Delete(Actor) を連合へ送る経路は、この調査では確認できなかった。
- **問題**: 復元できる Profile・鍵は期限なく残る一方、復元できないフォロー関係などは退会時に即時削除される。
- **検討する論点**: 猶予期間の長さ、猶予中の連合での見え方（404 / 410）と Delete(Actor) の送信時点、猶予中に関係を保持して reactivate 時に戻すか、期限後に完全削除する対象（鍵・イベント・メディア・Kratos identity）、イベントソーシングでの完全削除方法。P1 では退会イベントでホームの link を解除し自動では復活させない方針のため、post-relay の隔離データとの整合も確認する（P1 の link 契約: `intents/shuttlepub/decisions/2026-11-21-emumet-p1-open-items.md:35`、転送 envelope: 同 `:33`）。

## 初回リリース (publish 対象外の運用作業)

### `emumet-first-release`

- **状態**: 未着手。`emumet-release-container` (#110、完了) が作ったリリース機構を使い、初めて `v*` タグを push する作業。
  タグの push と GHCR の公開範囲の変更は、それぞれユーザーの明示許可が要る ([operations/release.md](../operations/release.md) の「Not done / pending」)。
  packet は作らない (Emumet のコード変更を伴わない運用作業のため)。コード変更が必要になったら別の packet にする。
- **範囲**: 初回の `v*` タグ (CalVer) の push と GHCR への公開、GHCR パッケージの公開範囲の変更と匿名 pull の確認、
  D53 の `dev` ブランチ新設と dev イメージ公開の開始 (初回リリースと同時)。
- **完了条件 (D68 を含む)**:
  - 上の範囲の作業が、ユーザーの明示許可のもとで行われ、結果が [operations/release.md](../operations/release.md) に記録されている。
  - **`POST_RELAY_INBOX_ENABLED` の扱い (D68、[決定](../../shuttlepub/decisions/2026-11-21-emumet-p1-open-items.md))**:
    リリースの時点で ShuttlePub の転送の受け口がそろっていれば、`POST_RELAY_INBOX_ENABLED=true` にする
    (オンにする条件: 受け口の実装とデプロイ、`PUBLIC_BASE_URL`・サーバー鍵・許可 origin・承認済みのホームの link・容量の確認、
    連合 E2E が通っていること)。そろっていなければ、`POST_RELAY_INBOX_ENABLED` がオフのままであることと、その理由
    (ShuttlePub の受け口がまだなく、オンにしても送信が失敗して隔離に溜まるだけになる) を、リリースノート
    (GitHub Release の本文) に書く。どちらの場合も、この項目の完了時にどちらだったかを記録する。
    オフのまま出した場合は、受け口の完了時にオンにする作業が roadmap の「転送の受け口」の完了条件に残る。
- **依存**: `emumet-release-container` (完了)。D68 の判断には、ShuttlePub の転送の受け口 (roadmap P1) の状況の確認が要る。

## Deferred(open question 解消が先)

| feature | ブロッカー |
|---|---|
| post-relay | **P1 実装中**: C0/K1/L1/Q1/S1/I1 はマージ済み (Emumet PR #115 `f8fe0b4`、#119 `24a65ae`、#120 `a625d59`、#122 `7efe25c`、#125 `e26fced`、#126 `b054788`)。B1 (issue #127) は実装中、T1 (issue #128、モック受け手を使う E2E) は未着手。転送契約などの基本方針は D61–D67 で確定。**残件**: K2 (鍵の更新・失効)、ShuttlePub 側の受け口、連合 E2E、署名 API と sharedInbox (P2/P3)。`POST_RELAY_INBOX_ENABLED` は既定オフとし、ShuttlePub の受け口・必要な運用準備・連合 E2E がそろったら有効化する (D68、host commit `da15c2e`)。 |
| shuttlepub-link | 連携先との認証方式、ShuttlePub 本体側の実装状況。**再開条件: 同上 (C2 と同時)** (2026-08-12 grill) |

## Host-only(publish 対象外)

- docs 同期: ShuttlePub/document の data-structure.md が実装より古い
  (Moderation「未実装」記載、StellarAccount の再解釈)。Emumet issue ではなく
  document リポジトリ側で対応する。

## 運用メモ

- 一度に publish するのは先頭 1 件のみ(stack のデフォルト境界)。
- 各 packet 完了時に対応する features/*/packets.md へ issue リンクを追記する
  (各 packet の knowledge_updates.intent_tree 参照)。
