# profile-federation — acceptance

> 契約・検証境界。個別 unit の受け入れ詳細は各 packet が正本。overview は [overview.md](overview.md)。

## 全体の完了条件（P4 完了時）

- [ ] Profile が actor・follow graph・個別 block/mute の主体になり、旧 Account 単位の連合経路が廃止されている
- [ ] 全 Profile に一意・不変の username があり、Account 名とは独立している。Profile 移管後も username・actor URI・鍵・関係が維持される
- [ ] 旧連合データのみ初期化され、AuthAccount・Account・Profile・組織 membership・イベント履歴・全体モデレーションは保持される
- [ ] 再実行しても再消去・鍵再生成が起きない
- [ ] Mastodon / Iceshrimp / mock peer E2E が新 Profile モデルで成功する

## unit ごとの検証境界

| unit | 検証 | 境界・非目標 |
|---|---|---|
| E8 | OpenAPI 再生成、旧作成 payload・新 payload・未実装エラーの contract test、既存 Rust CI | 契約のみ。新関係処理・方針保存・username 保存は実装しない |
| P1 | 実 DB、イベント再適用、移管、鍵署名、実 root 構成の route 不在テスト（確定形は下記「P1 確定契約」） | 本番 `/ap/profiles/...` は未 mount。root で新配送 worker を起動しない |
| P2 | 独立 DB/schema での migration・repository・競合テスト（確定形は下記「P2 確定契約」） | 本番 migration・dual-write・変換ツールなし。旧 schema のテストと同じ DB を同時変更しない |
| P3o | DB transaction、fake peer、timeout・再起動・二重 worker | 外部配送失敗でローカル unfollow を巻き戻さない。本番 route・worker は未接続 |
| P3i | 署名付き HTTP fixture、実 DB、重複・順序逆転・不正参照 | 投稿 Activity の認可・実受理は対象外。本番 route は未 mount |
| FN | BFF REST 変換、GraphQL 生成、SSR/hydration、visual、P1 との実接続 | username 変更は対象外。P4 に依存しない |
| P4 | 移行前 fixture→移行後 DB、再実行、署名、WebFinger、Follow・個別 block/mute、移管後 identity 維持、許可 username 文字種、E2E | 旧 identity 保存・互換 Follow API・Move・無停止移行・DB 全消去は対象外 |

## 共通の契約

- 認可は現在の所有者（Account／組織 membership）による。外部 ID は nanoid。
- username 更新 API を通常の編集機能として設けない。
- P1〜P3 の Profile actor・関係 route は本番未 mount であることを OpenAPI schema 説明にも記載する（E8）。
- E8 はマージ済み（Emumet PR #70、squash `0bfa437`）。username 段階 E8 の確定形（形式・予約語違反 400／有効値 501／副作用前拒否／読取は null 可）、followers 応答型の分離、Profile actor URL は P1 で確定、未 mount 不在テストの強化（共有 router 構成）は P1/P4 へ引き継ぎ。詳細は [DC acceptance](../personal-domain-controls/acceptance.md) の「E8 確定契約」。
- ShuttlePub 側の投稿操作の受理・送信拒否は本 feature の対象外（[DC acceptance](../personal-domain-controls/acceptance.md) 参照）。

## P1 確定契約（Emumet PR #78、2026-11-10 マージ済み、squash `e2e3b46`）

> 実装は `ShuttlePub/Emumet` の kernel（`entity::profile`、`entity::profile_signing_key`、`activitypub::ActorUrlBuilder::for_profile`）、driver（`postgres/profile*`）、
> application（`service::profile_username`、`profile_signing_key`、`service::activitypub::profile_actor`）、server（`root_router.rs`、`route/activitypub/profile_actor.rs`）。
> 検証は `DATABASE_URL` を設定した実 DB（skip なし）で、CI（Rust / E2E）全 green。D08 全体は ready／完了ではない。

### username
- 形式 `^[a-z0-9][a-z0-9._-]{0,63}# profile-federation — acceptance

> 契約・検証境界。個別 unit の受け入れ詳細は各 packet が正本。overview は [overview.md](overview.md)。

## 全体の完了条件（P4 完了時）

- [ ] Profile が actor・follow graph・個別 block/mute の主体になり、旧 Account 単位の連合経路が廃止されている
- [ ] 全 Profile に一意・不変の username があり、Account 名とは独立している。Profile 移管後も username・actor URI・鍵・関係が維持される
- [ ] 旧連合データのみ初期化され、AuthAccount・Account・Profile・組織 membership・イベント履歴・全体モデレーションは保持される
- [ ] 再実行しても再消去・鍵再生成が起きない
- [ ] Mastodon / Iceshrimp / mock peer E2E が新 Profile モデルで成功する

## unit ごとの検証境界

| unit | 検証 | 境界・非目標 |
|---|---|---|
| E8 | OpenAPI 再生成、旧作成 payload・新 payload・未実装エラーの contract test、既存 Rust CI | 契約のみ。新関係処理・方針保存・username 保存は実装しない |
| P1 | 実 DB、イベント再適用、移管、鍵署名、実 root 構成の route 不在テスト | 本番 `/ap/profiles/...` は未 mount。root で新配送 worker を起動しない |
| P2 | 独立 DB/schema での migration・repository・競合テスト（確定形は下記「P2 確定契約」） | 本番 migration・dual-write・変換ツールなし。旧 schema のテストと同じ DB を同時変更しない |
| P3o | DB transaction、fake peer、timeout・再起動・二重 worker | 外部配送失敗でローカル unfollow を巻き戻さない。本番 route・worker は未接続 |
| P3i | 署名付き HTTP fixture、実 DB、重複・順序逆転・不正参照 | 投稿 Activity の認可・実受理は対象外。本番 route は未 mount |
| FN | BFF REST 変換、GraphQL 生成、SSR/hydration、visual、P1 との実接続 | username 変更は対象外。P4 に依存しない |
| P4 | 移行前 fixture→移行後 DB、再実行、署名、WebFinger、Follow・個別 block/mute、移管後 identity 維持、許可 username 文字種、E2E | 旧 identity 保存・互換 Follow API・Move・無停止移行・DB 全消去は対象外 |

## 共通の契約

- 認可は現在の所有者（Account／組織 membership）による。外部 ID は nanoid。
- username 更新 API を通常の編集機能として設けない。
- P1〜P3 の Profile actor・関係 route は本番未 mount であることを OpenAPI schema 説明にも記載する（E8）。
- E8 はマージ済み（Emumet PR #70、squash `0bfa437`）。username 段階 E8 の確定形（形式・予約語違反 400／有効値 501／副作用前拒否／読取は null 可）、followers 応答型の分離、Profile actor URL は P1 で確定、未 mount 不在テストの強化（共有 router 構成）は P1/P4 へ引き継ぎ。詳細は [DC acceptance](../personal-domain-controls/acceptance.md) の「E8 確定契約」。
- ShuttlePub 側の投稿操作の受理・送信拒否は本 feature の対象外（[DC acceptance](../personal-domain-controls/acceptance.md) 参照）。

・予約語は E8 の値を `kernel::ProfileUsername` に移して流用（暗黙の trim・小文字化なし）。Account 名から導出しない。
- 保存: `ProfileEvent::Created.username`（任意。`skip_serializing_if none` なので旧イベントは無変更）と一回限りの `ProfileEvent::UsernameSet`。`profiles.username` に射影し、イベント再適用（projector の全再構築）で復元される。
- **一意・削除済み再利用不可・一回限りは DB で保証**: 追記専用で Account/Profile 削除後も残る `profile_events` の部分 unique index 2 本（`profile_events_username_unique` = `data->>'username'`、`profile_events_username_once_per_profile` = `id`）。違反は `KernelError::Concurrency` → HTTP **409**。競合する同時設定は片方のみ成功。`profiles.username` にも部分 unique（二重防御）。
- **一回限り設定 API**: `POST /api/v1/profiles/{profile_nanoid}/username` body `{"username"}` → 200 `ProfileResponse`。現在の所有者のみ（個人は Keto `account_edit`、組織は `X-Organization-Id` の組織 context）。400（形式・予約語）/ 403 / 404 / 409（設定済み・重複・認可後に所有者が変わった）/ 422（Account 停止中。認可後に unfiltered で取得するので 404 にならない）。PUT/PATCH/DELETE は作らない（OpenAPI テストで固定）。
- 作成 API: `POST /api/v1/accounts` `profile_username`・`POST /api/v1/profiles` `username` は optional のまま 501 から保存へ。形式不正は副作用前に 400、重複は 409 で何も作らない。省略した旧 payload は 201。`ProfileResponse.username` は値 or null。

### 移管・通常編集との競合（並行性）
- 設定 use case は認可後、write transaction の**先頭で Profile 行を `FOR NO KEY UPDATE`**（`ProfileReadModel::lock_by_id_for_update`）し、認可した所有者・username 未設定を再確認してから保存する。移管の projection UPDATE と同じ行をロックするため、旧所有者向けに認可された要求が移管後の Profile に（変更不能な）username を設定することはできない（409）。D8P の `FOR SHARE`（所有者判定）ともこのロックで競合する（読取側と書込側の関係）。
- projection 書込は username を **NULL→値のみの単調更新**: read model `update` と projector `upsert` は `COALESCE(既存, 新)`、設定専用の `ProfileReadModel::set_username` は version を後退させない。username を観測できなかった通常編集（旧イベント列から再構築した projection）が保存済み username を消さない。
- 実 DB の競合テスト: `username_request_authorized_for_the_old_owner_is_refused_after_a_concurrent_transfer` / `transfer_waiting_behind_a_username_write_keeps_the_username` / `stored_username_survives_a_concurrent_profile_edit_and_the_projector` ほか。

### Profile actor URL・鍵・WebFinger（本番未 mount）
- actor id / `url` / `publicKey.owner`: `{PUBLIC_BASE_URL}/ap/profiles/{profile_nanoid}`。inbox / outbox / followers / following は末尾 `/inbox` `/outbox` `/followers` `/following`。**key id は `{actor id}#main-key`**。path は username ではなく nanoid（不変の Profile identity 由来なので移管で変わらない）。acct は `username@{PUBLIC_BASE_URL の host[:port]}`（`/.well-known/webfinger`、domain は本 instance と大文字小文字無視で一致が必要）。
- Profile は **username と有効な鍵の両方**を持って初めて actor／WebFinger が解決する（欠けると 404）。
- 鍵: 新テーブル `profile_signing_keys`（`profile_id` 所有、~~Profile 行削除で cascade~~ → **P4 で契約変更: FK を外し、Profile 行の削除（Account 無効化の projection でも削除される）後も鍵を保持して、再 materialize 時に同じ鍵で復帰。actor は Profile 行が無い間 404 で非公開**（Emumet PR #91、migration `20261121000001`）。アルゴリズム・暗号化形式は `signing_keys` と同一の JSONB）。非失効鍵は Profile あたり 1 つ（部分 unique index。二重生成は `Concurrency`）。所有主体は Profile で、移管で変わらない。use case は `CreateProfileSigningKeyUseCase` / `GetProfilePublicKeyUseCase` / `SignProfileRequestUseCase`（route には出さず、新しい汎用署名 API は作らない）。**本番コードは鍵を生成しない**（P4 が一回限り生成を所有）。
- 本番 router 構築は `server/src/root_router.rs::build_root_router`（`main.rs` は呼ぶだけ）。テスト router（`build_test_router_with_auth`）も同関数に委譲し、本番と同じ構成で route 不在テスト（`profile_actor_and_contract_routes_are_absent_from_the_root_router`）と main の worker 起動検査（`main_starts_no_profile_delivery_worker`）を行う。E8 の `GET /ap/profiles/{nanoid}` 501 skeleton は実 handler（tag `ProfileActor`、未 mount）に置換、WebFinger の Profile 版は `ProfileActorRouter`（テストのみ）。
- migration `migrations/20261105000001_profile_username_and_actor_keys.sql` は非破壊の追加（nullable 列・index・新テーブル）で**通常の `migrations/` として本番適用される**。P4 は再採番しない（P4 は破壊的 migration と P2 テーブルの本番採番のみ所有）。

### 引き継ぎ
- **version 後退（should）**: `ProfileReadModel::update`（`driver/.../profile.rs`）の通常更新は `version = $7` を無条件に書くため、逆順競合で projection version が後退しうる（projector が再適用して収束する）。`GREATEST(version, $7)` と逆順テストを後続 unit で検討する。
- **未 mount テストの寄せ替え（should）**: E8（`profile_policy_tests.rs`）・D8P（`profile_domain_control`）の「未 mount」文字列検査は main.rs/root_router.rs のソース検査が中心。実 root 構成の検査（`route/tests.rs`）へ寄せるのは P3o／P3i／P4 での mount 時に行う（mount した unit は不在テストの対象から外し、存在テストへ置換）。
- P3o/P3i: 新配送 worker を `main` から起動する場合は `main_starts_no_profile_delivery_worker` を意図的に更新する。actor URL の構築は `ActorUrlBuilder::for_profile` を使う。

## P2 確定契約（Emumet PR #77、2026-11-10 マージ済み、squash `f523b86`）

> 実装は `ShuttlePub/Emumet` の kernel（`entity::profile_graph`、`repository::profile_*`）と driver（`postgres/profile_*`）。
> schema と初期化 SQL は **隔離 DB 用 fixture** `driver/fixtures/profile_social_graph/` に置き、本番 `migrations/` には追加していない（P4 が採番・配置）。
> 型名の `Graph` 接頭辞は P1 等との衝突回避。P1（PR #78）の確定 — Profile actor URL `{PUBLIC_BASE_URL}/ap/profiles/{nanoid}`、Profile 鍵は新テーブル `profile_signing_keys` — とは独立で矛盾しない
> （ローカル actor の URL は保存せず `ProfileId` から P1 が導出する。P2 は旧 `signing_keys` を参照しない）。

### 保存項目

関係の主体は `Local(ProfileId)`（`profiles.id` への FK、`ON DELETE CASCADE`）。リモートは canonical actor URL（TEXT）のみで、旧テーブルは参照しない。
当事者の型は `ProfileGraphActor { Local(ProfileId), Remote(GraphActorUrl) }`（E8 の API 型 `ProfileActorRef` の保存側）。
URL 系の型 `GraphActorUrl` / `GraphActivityId` / `GraphInboxUrl` は http(s) の最低限の検証のみで**正規化しない**（canonical 形は呼び出し側＝P1 の URL 規則が決める）。
URL 系の列は **1024 バイト以下**（kernel の検証と DB の CHECK。複合 B-tree 索引の行サイズ上限を超えないため）。

| テーブル | 内容 |
|---|---|
| `profile_follows` | Follow の**世代**。follower/followee（local `profile_id` か remote `actor_url` の一方）、**元 Follow activity ID**、state `pending`/`accepted`/`ended`、終了理由 `undone`/`rejected`/`blocked`、`accepted_at`/`ended_at`、API 用 `nanoid`。有効な世代（ended 以外）は (follower, followee) ごとに高々 1。世代の識別は follower ごとの activity ID の一意。終了済みの世代も残す。remote→remote・自己 Follow は不可（CHECK） |
| `profile_blocks` / `profile_mutes` | 個別設定。owner は常にローカル Profile、target は local Profile か remote actor URL。API 用 `nanoid`。自己指定は不可 |
| `profile_inbound_activities` | 重複受信記録。キー `(receiver_profile_id, actor_url, activity_id)`、`receive_count`、初回/最終受信時刻 |
| `profile_delivery_jobs` | 配送 job。冪等キー `(sender_profile_id, activity_id, target_inbox)`。activity 種別 `Follow`/`Accept`/`Reject`/`Undo`（個別 actor block の AP `Block` を D8R が追加。DB CHECK は D8R の新 migration `20261122000001` で `Block` を許可。domain block は `Block` を送らない）、**送信本文のバイト列そのもの**（TEXT。HTTP 署名 digest のため正規化しない）、`follow_id`、state `pending`/`in_flight`/`retrying`/`delivered`/`failed`/`cancelled`、`attempt_count`、`next_attempt_at`、lease（`lease_owner`/`lease_token`/`lease_expires_at`）、最終結果・HTTP status・失敗理由、取消理由 |
| `profile_delivery_attempts` | 試行履歴 `(job_id, attempt_no)`、開始/終了、結果分類、HTTP status |

### Follow の世代の契約（P3i/P3o）

- `ProfileFollowRepository::begin_generation(&ProfileFollow) -> BeginFollowOutcome`
  - `Created`: 新しい世代を保存した。
  - `ReplayedActivity(existing)`: 同じ (follower, 元 activity ID) の世代が既にある。**終了済みでも**これを返し、古い activity の再送で世代は復活しない（block 解除後の復活防止に使う）。
  - `ActiveGenerationExists(existing)`: 同じ組の有効な世代が別の activity ID で既にある。処理方針は P3i が決める。
  - 同時実行しても有効な世代は 1 つ（同一 activity ID の同時再送も 1 件だけ作成）。
- `accept`（pending→accepted）と `end`（有効→ended）は compare-and-swap で、既に遷移済みなら false。
- `end_active_between(a, b, reason, now)` は両方向の有効な世代を終了して返す（block の「双方向 Follow 解除」用。受理済みかは `accepted_at` で判別）。block 本体の適用（拒否判定・解除・job 予約）は use case（P3o/P3i）の責務。
- 一覧は `list_following(profile)` / `list_followers(profile)`（有効な世代、ID 昇順の cursor）。

### 共通 enqueue interface（P3o/P3i 向けに固定）

```rust
// kernel::interfaces::repository
trait ProfileDeliveryEnqueuer {
    fn enqueue(&self, executor: &mut Connection, job: &NewProfileDeliveryJob)
        -> Result<EnqueueOutcome /* Enqueued(id) | AlreadyEnqueued(id) */, KernelError>;
}
// NewProfileDeliveryJob::new(sender: ProfileId, DeliveryActivityType, GraphActivityId,
//     GraphInboxUrl, payload_json, now)?  .with_follow(ProfileFollowId)  .not_before(OffsetDateTime)
```

- **関係変更と job 予約を同一 transaction にする契約**: 他の repository と同様に、呼び出し側の接続（transaction）上で動く。`begin_generation` / `end` 等と `enqueue` に同じ transaction 接続を渡せば同時に commit / rollback される（rollback で両方残らないことを実 DB で検証済み）。
- 冪等キー `(sender, activity_id, target_inbox)`。同じ組は新しい job を作らず `AlreadyEnqueued`（終端状態の job も再作成しない）。
- payload は JSON オブジェクト（最大 1 MiB）を加工せず保存する。

### 配送 worker 向け port（`ProfileDeliveryJobRepository`、P3o が使う）

- `claim_due(worker_id, now, policy{lease_duration, limit, max_attempts})`: 試行可能な job（pending/retrying で `next_attempt_at <= now`、および lease 期限切れの in_flight）を lease つきで取得する。`FOR UPDATE SKIP LOCKED` により複数 worker が同時に呼んでも二重取得されない。期限切れ lease の回収では前回の試行を `lease_expired` として履歴に残し、`max_attempts` に達した job は再取得せず `failed(retries_exhausted)` にする。
- `record_attempt(claim, now, outcome)`: `lease_token` で fencing する。`Recorded`（状態更新）／`Cancelled`（送信中に取り消された。履歴だけ残し状態は cancelled のまま）／`LeaseLost`（lease を失っていた。何も記録しない）。outcome は `Delivered` / `Retry{next_attempt_at,...}` / `Failed{reason,...}`。バックオフと再試行上限の判断は worker（P3o）の責務で、保存層は結果を記録するだけ。
- `cancel(id, reason, now)`: 未配送（pending/in_flight/retrying）を取り消す。配送済み・失敗・取消済みは false。送信中の取消は送信済み activity を取り戻せない。
- `cancel_undelivered_for_follow(follow_id, activity_type, reason, now)`: 関係に紐づく未配送の指定種別の job をまとめて取り消す（例: unfollow 時の未送信 Follow）。
- 参照: `find_by_id` / `find_by_key` / `list_attempts`。

### 旧連合データの初期化（P4 へ渡す一覧）

`02_reset_legacy_federation.sql`（隔離 DB 用 fixture。P4 が versioned migration として本番配置する）:

- **対象**（`TRUNCATE TABLE` で明示列挙、**CASCADE なし**）: `follows`、`blocks`、`mutes`、`remote_accounts`、`outbox_activities`、`signing_keys`（旧 Account に紐づく連合鍵）。
- **非対象（保持）**: `auth_hosts`、`auth_accounts`、`auth_emumet_accounts`、`accounts`、`profiles`、`metadatas`、`images`、`organization_members`、`profile_transfer_requests`（+events）、`account_events`、`profile_events`、`metadata_events`、`account_report_events`、`account_reports`、`registration_gate_*`、`projection_checkpoints`、新モデル（`profile_follows` 等）の全テーブル、P1 の `profile_signing_keys`。
- **一回限り**: 台帳 `profile_federation_resets` に `legacy-account-federation-v1` を記録し、確認と消去を同一 transaction で行う。再実行しても再消去しない（初期化後に作られたデータは消えない）。
- 対象を参照する外部キーが非対象テーブルにあれば TRUNCATE は失敗する（黙って巻き込まない）。失敗時は全体 rollback で何も消えず、台帳も残らない。
- 検証済み（独立 DB）: 全テーブルの行数・内容 hash の前後照合（非対象は不変・対象は空）、再実行、CASCADE 不使用と対象一覧の静的検査、対象を参照する非対象テーブルが無いことのカタログ検査、依存テーブルがあれば失敗して rollback、新 schema 適用前でも実行可。

### P4 への申し送り

- 初期化対象の `signing_keys`（旧 Account 鍵）と P1 の `profile_signing_keys`（新 Profile 鍵）は別テーブル。reset は `signing_keys` のみ対象で `profile_signing_keys` を保持すること。新 Profile 鍵の一回限り生成は P1 の保存先に対して行う。本番 migration 化の際は、P1 のテーブルが対象外であることを P2 の保持照合テスト（全非対象テーブルの自動照合）で確認する。
- `images` は `remote_accounts.icon_id` から参照されていたが共有資産なので保持する。旧リモート icon の孤児画像は残りうる（掃除は P4 の判断）。
- 本 fixture の SQL をそのまま versioned migration にし、台帳テーブルも含める。schema fixture（`01_...sql`）も同様に P4 が採番して配置する。
- remote actor の取り込み（inbox・公開鍵キャッシュ）用のテーブルは P2 に無い。必要なら P3i が追加する。
- `impl_database_delegation!`（kernel/src/lib.rs）には未追加。P3o/P3i が AppModule へ接続する際に `DependOnProfile*` 等を追加する（driver の `PostgresDatabase` には実装済み）。

## P3i 確定契約（Emumet PR #87、2026-11-10 マージ済み、squash `13a1cf8`）

> 実装は `ShuttlePub/Emumet` の `application::service::activitypub::profile_inbound`（`ProfileInboxUseCase`）、`application::service::profile_follow_list`、server の `route::activitypub::profile_inbox` / `route::profile_follow_list`。
> route は **本番 root router へ未 mount**（テスト専用の `ProfileInboxRouter` / `ProfileFollowListRouter`）。worker も起動しない。P2 の interface は変更していない。

### 受信 Activity 対応表（`POST /ap/profiles/{profile_nanoid}/inbox`）

| 受信 Activity | 条件 | 効果 | HTTP |
|---|---|---|---|
| `Follow` | `object` = この Profile の actor URL | 署名 actor を follower とする **accepted 世代**を保存し、**Accept 配送 job を同一 transaction で予約**（自動 Accept。宛先は follower の actor 文書の inbox） | 202 |
| `Follow`（この Profile が署名 actor を個別 block 済み） | 同上 | accepted にせず、**ended(blocked) 世代**を元 Follow ID で保存し、**`Reject(Follow)` job を同一 transaction で予約**。AP Block は送らない。block 解除後に同じ Follow が再送されても世代は復活せず、新しい Follow だけが accepted になる | 202 |
| `Accept` | `object` = この Profile が送った Follow（埋め込み or ID 文字列） | pending 世代 → accepted（CAS） | 202 |
| `Reject` | 同上 | 有効世代（pending / accepted）→ ended(rejected) | 202 |
| `Undo` | `object` = 署名 actor の Follow | 有効世代 → ended(undone)。block 中も許可（後始末） | 202 |
| 上記以外 | 投稿 Activity（Create / Like / EmojiReact / Announce / Delete …）、`Block` / `Undo(Block)`、Follow 以外への Undo / Accept / Reject | **非対応**。関係・重複記録・job を一切変えず無害に受理のみ（投稿の認可・実受理は ShuttlePub の後続責務、domain 方針は D8G） | 202 |

### 署名検証・照合

1. route: HTTP Signature 検証（不正・欠落・本文改ざんは 401）→ 鍵 owner = `activity.actor`（不一致は 401）。use case に渡す署名 actor は鍵 owner で、use case でも `activity.actor` と再照合する。
2. use case: inbox の Profile が存在し actor（username + 有効鍵）であること（無ければ 404）。署名者が自インスタンス（`{PUBLIC_BASE_URL}/ap/…`）の actor URL なら 422。
3. `Follow` の `object` が inbox の Profile でなければ 422。埋め込み Follow を持つ `Undo` は、埋め込み Follow の actor が Undo の actor、object が inbox の Profile でなければ 422。
4. `Accept` / `Reject` / `Undo` は **元 Follow activity ID**（P2 の世代識別子）で世代を引き、両当事者（Accept/Reject: follower=この Profile・followee=署名 actor、Undo: follower=署名 actor・followee=この Profile）を照合する。合わなければ関係を変更せず 202（Accept/Reject の埋め込み Follow が合わない場合も同様）。
5. remote follower の inbox は書き込み前に既存の `resolve_remote_actor`（SSRF 対策済み）で解決する。解決できなければ何も保存せず 408（再送可能）。**remote actor テーブルは追加しない**（Accept/Reject の宛先は job の `target_inbox` に保存）。

### 無害化規則

- **重複受信**: P2 の重複受信記録を関係変更と**同一 transaction**で記録（再受信は `receive_count` だけ増える。失敗して rollback すれば記録も戻り、再送で再処理される）。非対応 Activity は記録しない。
- **古い Accept / Reject**（ended の世代を指す）: 何もしない。新世代の pending は変わらない。別 Profile / 別 actor の世代への操作も何もしない。
- **有効世代の置換**: 同じ actor が別 activity ID の Follow を再送した場合、その actor 自身の旧世代のみ ended(undone) にして新世代を accepted にし、新しい Accept を予約する。
- **順序逆転**: Undo が Follow より先に届く場合、埋め込み Follow が inbox の Profile 宛てなら ended(undone) 世代を保存して後着の Follow を無効化する（後着の Follow は P2 の `ReplayedActivity`）。**ID 文字列だけの Undo は宛先 Profile を確認できない**ため世代を作らず（世代の一意キーは follower + Follow ID で受信 Profile を含まず、別 Profile 宛ての本物の Follow を巻き込むため）、受信 Profile に限定した重複受信記録（`activity_type = UndoFollow`、キーは元 Follow ID）だけを残す。同じ Follow が別 Profile に届いても影響せず、同じ Profile に後着した場合は重複として無視される。Accept / Reject が Follow 登録より先に届く（未知の元 Follow ID）場合は何も作らない。
- **並行性**: 受信の全 transaction（Follow / Accept / Reject / Undo）は先頭で **Profile 関係ロック**（`kernel::interfaces::repository::ProfileRelationshipLock::lock_profiles`、`pg_advisory_xact_lock`。P3o と共通の規約: transaction の先頭で一度だけ関与するローカル Profile を ID 昇順に取得）を取る。個別 block の判定・Follow 保存・Undo の世代照合がこのロックで直列化されるため、block 書込と Follow の競合、Follow と Undo の競合で関係が残ったり取りこぼされたりしない。念のため Undo の tombstone 作成が既存世代（`ReplayedActivity`）を返した場合も両当事者を再照合して対象世代を終了する。

### Accept / Reject 予約と関係変更の同一 transaction

Follow 受信は 1 transaction で「関係ロック → 重複記録 → block 判定 →（置換時は旧世代終了）→ 世代保存 → Accept（block 時は Reject）job 予約」を行う。予約が失敗すれば世代も重複記録も残らず、commit 時の関係変更失敗でも予約済み job は残らない（実 DB テストで確認）。Accept / Reject / Undo の受信では job を予約しない。Accept の署名配送は P3o の worker。

### followers / following 読取（E8 確定契約どおり）

- `GET /api/v1/profiles/{profile_nanoid}/followers` → `ProfileFollowerListResponse`（`follower` = `ProfileActorRef{kind: local|remote, actor_url 必須, profile_id は local のみ}`）、`.../following` → `ProfileFollowListResponse`（`target` = canonical actor URL。local 対象は `{PUBLIC_BASE_URL}/ap/profiles/{nanoid}`）。`state` は pending / accepted（ended は出ない）。
- 認可は **現在の所有者のみ**（D8P の `require_profile_owner`: Profile 行 `FOR SHARE` ロック + 所有者確認 + 読取を 1 transaction）。401 / 403 / 404。別 Profile・他 Account の関係は返さない。
- 古い順。`cursor` は不透明な `next_cursor`（不正は 400）、`limit` は既定 20・1..=100 に clamp。

### 検証

署名付き HTTP fixture（有効署名・別鍵・署名なし・本文改ざん・署名者と actor の不一致）、隔離 DB（本番 migrations + P2 fixture）、重複・同時重複・順序逆転・古い Accept/Reject・別 Profile / 別 actor・不正参照・非対応 Activity、個別 block 時の受信 Follow（Reject・解除後も復活しない・Profile / actor 単位）、block 書込中の Follow の待機、Follow と Undo の競合（ロック待機と、tombstone 作成時に既存世代が返る経路）、裸 ID Undo の誤配送、Accept 予約失敗時の rollback、followers/following（local/remote・pagination・所有者以外 403）。実 root 構成（`build_root_router`）で E8 / D8P / P1 / P3i の全 route が 404 であること（実在 Profile + 所有者でも）と、`main` が root router 以外の route を足さないことを検査。

### P4 / 後続への申し送り

- 本番 mount と旧 `/ap/accounts/{id}/inbox` の撤去は P4。P3i の route を mount した unit は `route/tests.rs` の不在テストの対象から外し、存在テストへ置換する。
- D8G: 受信 Follow への **domain 方針**（domain block / mute）の適用は未実装。`handle_follow` の個別 block 判定の隣に挿入する（同じロック規約の下）。
- 受信側の `UndoFollow` 重複受信記録は P2 の `profile_inbound_activities` を流用している（保持期間の purge 対象）。
- Undo 時に未配送の Accept job を取り消す処理（`cancel_undelivered_for_follow`）は P3o の関係終了処理が行う。P3i の Undo は job に触れない。
- **実 HTTP 取得を通す結合テスト（P4）**: P3i のテストは鍵・actor 文書をテスト用キャッシュ（test-mode）で注入するため、署名鍵・actor 文書の実取得、redirect、SSRF 検査と inbox の結合は通っていない。fake peer（実 HTTP）による Profile inbox の結合テストを P4 の E2E に含める。
- **コメントの不一致（D8G）**: `profile_inbound/mod.rs` の `handle_follow` の「P3i accepts every well-formed Follow」というコメントは個別 block による拒否の実装と合っていない。D8G で domain 方針の判定を block 判定付近に移す際に直す。
- **purge と UndoFollow（P4）**: `InboundActivityRepository::purge_received_before` は `UndoFollow` 記録も削除する。purge を接続する際は、保持期間より遅れて届く Follow が（記録の消えた）Undo 済みの Follow として受理されないか注意する（保持期間の設計）。

## P3o 確定契約（Emumet PR #86、2026-11-10 マージ済み、squash `fc11471`）

> 実装は `ShuttlePub/Emumet` の kernel（`entity::profile_graph::delivery_policy`、`repository::profile_delivery_sender`・`profile_delivery`）、driver（`profile_delivery`＝送信 adapter・actor / WebFinger resolver）、application（`service::profile_relationship`＝use case・配送 worker・activity 組み立て）、server（`route::profile_relationship`・`api::profile_delivery_worker`）。
> route・worker とも **本番 root router・`main` へ未接続**（テスト専用の `ProfileRelationshipRouter` と `spawn_profile_delivery_worker`）。`openapi.json`・`root_router.rs`・`main.rs` は変更なし（OpenAPI は E8 の 501 skeleton のまま）。**AP Block の送信は確定（下記。実装は D8R、Emumet PR #93）。**

### use case（`ProfileRelationshipUseCase`）

| 操作 | route（テスト router のみ） | 効果 |
|---|---|---|
| `follow_profile` | `POST /profiles/{id}/follows` | remote 宛て: pending 世代 + `Follow` job を同一 transaction で予約。**ローカル Profile 宛て: HTTP を経由せず**、同じ transaction で承認済み世代を `Local(ProfileId)` 同士で確定（配送 job なし。下記） |
| `unfollow_profile` | `DELETE /profiles/{id}/follows/{follow_id}` | 世代を ended(undone) にし、未送信 Follow は取消、試行済みなら `Undo(Follow)` を予約 |
| `block_actor` / `unblock_actor` | `POST …/blocks`・`DELETE …/blocks/{id}` | block 保存 + 双方向の有効世代を ended(blocked) + 相手へ `Undo(Follow)`（自分→相手）/ `Reject(Follow)`（相手→自分）を予約。**P3o 時点では AP `Block` は送らなかったが、D8R で remote actor 宛てに `Block` を併用・解除は `Undo(Block)` に確定（下記）**。解除は関係を復元しない |
| `mute_actor` / `unmute_actor` | `POST …/mutes`・`DELETE …/mutes/{id}` | 表示抑制の設定のみ。関係・配送は変えない |
| following 一覧 | `GET …/following` | **P3i の `ProfileFollowListUseCase`・`route_profile_follow_lists` に一本化**（P3o は一覧を持たない） |

- 認可は現在の所有者のみ（`require_profile_owner`、個人は Account、組織は `X-Organization-Id`）。エラー: 400（不正 target・自己・解決不能）/ 403 / 404 / 409（重複）/ 422（個別 block による Follow 拒否）。関係の主体は常に `Local(ProfileId)`。同じ Account の別 Profile・他 Account の Profile には波及しない。
- **関係状態と配送状態は別物**: 関係変更と job 予約は同一 DB transaction（予約失敗で関係変更も残らず、関係変更失敗で job も残らない）。外部配送が失敗・timeout しても unfollow・block は巻き戻らない。
- **domain 方針は読まない**（D8G/D8R が所有）。domain block が保存されていても個別 Follow は拒否されず、個別 block は domain 方針に書かない。
- target の書式: actor URL、`acct:name@domain`（`acct:` と先頭 `@` は省略可）、ローカル Profile の nanoid。`acct:` は **transaction の外・所有者認可の後**に WebFinger（`/.well-known/webfinger?resource=acct:name@domain`。`subject` の一致必須・ActivityPub の self link 必須。宛先検査は送信 adapter と同じ）で canonical actor URL に解決し、解決不能は 400。認可されない呼び出しは外向き request を出さない。

### 関係ロック規約（`ProfileRelationshipLock`、P3i の確定契約と共通）

- 判断・変更に関わる**ローカル Profile を transaction の先頭（所有者認可の直後、関係の読み書きの前）で一度だけ**、ID 昇順に `lock_profiles`（`pg_advisory_xact_lock(hashtextextended('emumet.profile_relationship:{id}', 0))`、transaction 終了で解放）で取る。`FOR SHARE` の所有者ロックだけでは block 判定と Follow 保存・block 保存と既存 Follow の終了が interleave するため。
- P3o は follow / block で {自分, ローカル相手} を取る。unfollow / unblock / mute は CAS（`end`）や単一行操作で足りるため自分のみ／取らない。**D8G の domain block 適用・P3i の受信は同じ規約**を使う。
- 実 DB 競合テスト 3 件（Follow の保存中に block・同一 Profile の Follow と block・block の保存中の逆方向 Follow）は、ロックを無効化すると失敗することを確認済み。

### Local→Local の確定経路

自インスタンス actor からの HTTP 受信は P3i が 422 で拒否するため、ローカル Profile 宛て Follow は HTTP を経由しない。両 Profile の関係ロック下の同一 transaction で、相手（と自分）の個別 block を検査し（block 済みは 422 で確定しない）、P3i の受信 Follow と同じ意味論（承認不要）で **accepted 世代を `Local` / `Local` で保存**する。activity ID は通常の Follow と同形式で採番。配送 job は作らない。unfollow は ended(undone) のみ（Undo 配送なし）、block は双方向を ended(blocked) にするのみ（Undo/Reject 配送なし）。ローカル発の未送信 Follow job が残っている場合（block 受信側）は `cancel_undelivered_for_follow` で取り消す。

### activity ID と本文

- Follow: `{actor}/activities/{Follow 世代 ID}`、Undo: `{元 Follow の ID}/undo`、Reject: `{actor}/activities/{Follow 世代 ID}/reject`（actor = `{PUBLIC_BASE_URL}/ap/profiles/{nanoid}`）。**決定的**なので、同じ関係の再処理は冪等キー `(sender, activity_id, target_inbox)` で重複 job にならない。
- `Undo(Follow)` の `object` には**元 Follow の保存済み本文をそのまま埋め込む**（`@context` のみ除去）。宛先は元 Follow job の `target_inbox`。`Reject(Follow)` の `object` は相手の Follow（相手の activity ID・actor・object）、宛先はその Follow への Accept job（P3i が `follow_id` 付きで予約）の inbox。**Accept job が無い（承認前など）と宛先不明のため Reject は送らない**。
- 未送信（pending・試行 0）の Follow は取り消すだけで Undo を送らない。試行済みなら Undo を送り、送信中だった Follow があれば Undo は 120 秒後（その Follow が届き得る時間の後）に回す。`find_by_id` で取消後の試行回数を再読して判定（claim との競合に強い）。

### 署名と送信 adapter

- 署名は P1 の `SignProfileRequestUseCase`（Profile 鍵、key id `{actor}#main-key`）。**新しい汎用署名 API は作らない**。旧 `/internal/v1/accounts/{id}/sign` 等は変更なし。request: `POST`、本文は job に保存されたバイト列そのもの、`Digest: SHA-256=…`・`Date`・`Host`・`Content-Type: application/activity+json`・cavage `Signature`。鍵が未作成なら署名失敗として**送信せず再試行**（鍵作成後に配送される）。
- 送信 adapter（`HttpProfileDeliverySender`）と actor / WebFinger resolver（`HttpRemoteActorResolver`）は同じ宛先検査: https のみ、userinfo 不可、localhost・内部 IP 拒否、**DNS 解決後の再検査と接続先アドレスの固定**、redirect 拒否、timeout（解決 5s / 接続 10s / 全体 30s）、応答本文の上限。**末尾ドット付き host は名前解決の前に拒否**（検査名と接続名のずれによる DNS 固定の迂回を防ぐ）。http・loopback を許可する構築は `cfg(test)` / `test-mode` ビルドにだけ存在。actor 文書は署名なし GET で、`id` が要求 URL と完全一致することを要求（authorized fetch を要求する peer は未対応）。

### 永続配送 worker（`DeliverProfileActivitiesUseCase`）

- **lease は送信の直前に 1 件ずつ**取得（`claim_due(limit=1)`、`FOR UPDATE SKIP LOCKED`）。送信中は DB 接続を保持しない。結果は `lease_token` で fencing（`Recorded` / `Cancelled` / `LeaseLost`）。二重 worker は同じ job を二重に配送しない。
- **署名後・送信直前に `renew_lease`** で token・試行番号・InFlight・未期限切れ・未取消を再確認して延長し、失敗なら送信しない（`lease_lost` / `cancelled`）。`renew_lease` の期限判定・延長は `GREATEST(渡された now, DB の clock_timestamp())` 基準。worker は更新に使った時刻から**絶対期限**（`renewed_at + lease − 10s`）を持ち、更新が戻った後の残存時間を送信 budget にする（消費済みなら送信しない）。送信が budget を超えたら timeout として再試行。
- 再起動回収: lease が切れた in_flight は次のサイクルが `lease_expired` として履歴に残し回収・再試行。**バックオフ**: 60s から 2 倍（上限 6h）、`[50%,100%]` の jitter、429/503 の `Retry-After` は 6h を上限に尊重。**再試行上限 12 回**（lease 切れの回収も数える。初回から最後の再試行まで約 1 日）。lease 120s、1 サイクル 10 件。
- 分類: 2xx = 配送済み、408/429/5xx/timeout/接続失敗/DNS 失敗/署名失敗 = 再試行、3xx・その他 4xx・不正な宛先 = `failed(permanent_error)`、上限到達 = `failed(retries_exhausted)`。取消された job は取得されず、送信中の取消は履歴だけ残り cancelled のまま（送信済みは取り戻せない）。
- 常駐ループ `spawn_profile_delivery_worker`（`server::api::profile_delivery_worker`）は部品として置いただけで、`main` からは起動しない（`main_starts_no_profile_delivery_worker` を維持）。

### 非公開制御 job と公開 outbox

配送 job は `profile_delivery_jobs` だけに保存され、公開 outbox の生成元（`outbox_activities`）と共有しない。block 由来の Undo / Reject を含む操作の後も `outbox_activities` は増えず、`GetOutboxUseCase` の出力に現れない（実 DB テスト）。

### P2 の port への追加（読み取り・更新系のみ。保存・予約の契約は不変）

- `ProfileDeliveryJobRepository::find_by_follow(follow_id, activity_type)`（関係終了時に既存の Follow / Accept job の宛先 inbox・状態を引く）、`renew_lease(claim, now, extension)`（上記）。`ProfileDeliveryEnqueuer` / `NewProfileDeliveryJob` は変更なし。
- `kernel::impl_database_delegation!` に `DependOnProfileMuteRepository` と `DependOnProfileDeliveryJobRepository` の委譲を追加（他は P3i が追加済み）。

### AP Block 送信は確定（ユーザー決定 question-e6dfa2b98a9dc74491b19bbcf2ba5ca4、2026-11-11）

**個別 actor の block は AP `Block` を送る（Follow 解除の Undo / Reject と併用、解除時は `Undo(Block)`）。ドメインブロックは AP Block を送らない。** 実装は D8R（Emumet PR #93。P4 マージ後に rebase）:

- `block_actor`: remote actor 宛てに `Block`（`object` = 相手 actor、ID `{actor}/blocks/{block ID}`）を、関係解除・Undo/Reject の予約と同一 transaction で予約する。ローカル Profile 相手は配送しない。相手を解決できなくても block と解除は適用し、解除した Follow から分かる inbox があればそこへ、無ければ `Block` だけ予約しない。
- `unblock_actor`: 未送信の `Block` job は取消して `Undo` を送らない。送信済み・結果不明は元 `Block` を埋め込んだ `Undo(Block)` を同じ宛先へ予約（送信中だった可能性があれば、取消後に取り直した時刻から 120 秒 / lease 後。Follow の Undo と同じ規則）。
- 配送 job 種別の DB CHECK への `Block` 追加は D8R の新しい migration `20261122000001_profile_delivery_block_activity.sql`（P4 のコードは変更しない）。`ProfileDeliveryJobRepository::find_by_activity`、`ProfileBlockRepository::find_by_nanoid` を追加。
- 受信した `Block` / `Undo(Block)` は P3i のまま非対応（関係を変えない。テストで確認）。
- **block / unblock の繰り返し（D8R レビュー修正）**: 状態を変える操作は、actor 対（送信元 Profile × 相手 actor）の transaction 内排他ロックを取り、先に同じ actor 対の未配送 `Block` / `Undo(Block)`（配送中・再試行待ちを含む）を取り消す。actor を解決できなくても行う（宛先 inbox は解決済み → 同じ actor 対の最新 job → 解除した Follow の順）。取消の瞬間に送信中だった job（取消と同じ行ロックの下で読んだ状態と lease 期限。読取後に claim / renew で延びた期限を含む）があれば、actor 対ごとに 1 行の単調非減少の下限 `profile_block_settle.settle_not_before`（D8R の migration）を `max(取消後に取り直した時刻 + 120 秒, 取消時点の lease 期限, 既存値)` へ `GREATEST` で引き上げる。以後この actor 対の `Block` / `Undo(Block)` は必ず下限以上に始めるので、取消が遅くても・操作を繰り返しても前倒しされない。`unblock` は、相手側に block が残り得る（試行済みの `Block` があり、それを打ち消す `Undo` が配送済みでない）ときだけ最新のその `Block` を埋め込む `Undo(Block)` を予約する（取消済み Undo と衝突しない ID）。Follow の `Undo` / `Reject` の送信中判定も取消の瞬間の状態と lease を使う。

### 検証

実 DB（隔離 DB + P2 fixture）と fake peer（HTTP mock）で、原子性（trigger による予約失敗・関係変更失敗）、Undo が元 Follow ID を参照、配送失敗でも unfollow が戻らない、署名（Signature / Digest の検証・本文改ざん検出）・宛先 inbox・activity 内容、5xx / timeout / 429+Retry-After / 410 / 再試行上限、lease 切れ回収・繰り返し lease 切れ、**署名中に lease を失った worker の非送信・更新の停止で期限を越えた worker の非送信**、取消（事前・署名中・送信中）、二重 worker（8 job を 2 worker で配送し peer への到達は各 1 回）、署名鍵なし、重複予約の冪等、個別 block と domain 方針の非混同、Profile 間分離、**ローカル Profile 宛て Follow の確定・unfollow・block**、acct 解決（成功・subject 不一致・self link なし・404・未認可）、末尾ドット host の拒否、公開 outbox 非露出、P3o/P3i の route を同じ router に組み合わせて重複登録しないこと、実 root 構成で全 route 404。

### P4 / 後続への申し送り

- 本番 mount（route・worker 起動）と本番 migration の採番は P4。P3o の route を mount した unit は `route/tests.rs` の不在テストの対象から外し、存在テストへ置換する。worker 起動時は `main_starts_no_profile_delivery_worker` を意図的に更新する。
- **実 HTTP の結合（P4 の E2E）**: 配送・actor 解決・WebFinger の実 peer（Mastodon / Iceshrimp / mock peer）との結合は未検証（テストは loopback の fake peer）。署名なし GET を拒否する peer の扱いを含める。
- D8G: 送信側 Follow への **domain 方針**は未適用（個別 block 判定の隣に、同じ関係ロック規約の下で挿入する）。承認前の incoming Follow への Reject が宛先不明の件は、P3i が承認前の Follow の inbox を保存するようになれば拡張できる。
- 重複: server テスト用の独立 DB ヘルパが `driver::database::isolated_db`（P3o）と `server/src/route/profile_graph_test_support.rs`（P3i）の二系統ある。統合は P4 以降の掃除項目。

## RX 確定契約（Emumet PR #95、2026-11-11 マージ済み、squash `49acf9d`、unit `profile-identity-read-exposure`、Emumet#94）

計画外の追加 unit（ユーザー承認 question-da4ae5d616cf6197f307bfffdc86868a）。FN（shuttlepub-frontends#34）が既存 Profile を特定するための読取専用の追加。

### 応答

- `AccountResponse` に `profile_id`（Profile nanoid、**必須**）と `profile_username`（未設定は **null 可**）を追加。既存フィールド・ステータスは不変（追加のみ）。
- 対象は `AccountResponse` を返す 5 経路: `GET /api/v1/accounts`（cursor 一覧）、`GET /api/v1/accounts?ids=`、`GET /api/v1/accounts/{id}`、`POST /api/v1/accounts`、`PATCH /api/v1/accounts/{id}`。すべて `AccountDetailDto`（`ProfileIdentityDto`）から構築。新 endpoint・permission・username 更新手段・Profile 一覧 API は追加していない。

### 認可・可視性（既存と同一。変更なし）

- 他人の Account は個別取得 404・ids 指定は結果に含まれず、Profile 識別子も露出しない。
- 無効化 Account は全経路で返らない。停止・BAN 中の Account は ids 指定・個別取得では返らず、**所有者の cursor 一覧だけ**が `moderation` 付きで返す（項目に Profile 識別子を含む）。

### 代表 Profile 規則と限界

- 個人 Account は個人 Profile 1 件（partial unique index）。組織 Account は複数 Profile を持ちうるため、**account あたり最小の Profile id の「代表 Profile」1 件だけ**で記述する。表示項目（display_name 等）と `profile_id` / `profile_username` は同一 Profile。read（`compose_account_details`）と update（`find_by_account_id` を `ORDER BY id LIMIT 1`）で同じ規則のため GET と PATCH が一致する。
- **限界**: 移管した Profile は、代表に選ばれた場合のみ移管先の組織 Account の応答に返る（移管先が既存 Profile を持つ場合に返る保証はない）。組織の全 Profile の発見や、選択値の不変性（後から小さい id の Profile が加わると代表が変わる）は保証しない。**組織の複数 Profile の列挙は範囲外（後続課題。Profile 一覧 API が必要）**。
- 移管元の個人 Account は Profile が 0 件になり、従来どおり `Profile not found for account`（NotFound）。本 unit では変更していない。

### 検証

- 実 DB route test（`client_profile_identity_tests.rs`、5 本）: 全経路の値（username あり/なし）、他人の Account、無効化・停止・BAN、実際の `Profile::transfer_account` イベントによる移管、3 Profile の組織での GET/PATCH 一致。無効化は projector 非同期のため `accounts.deleted_at` を直接設定して検証。`openapi_spec_matches_committed_file` と CI の openapi-check は通過。

### 引継ぎ・後続への申し送り

- **P4（Emumet PR #91）統合注意**: `update.rs` の `into_detail` に新引数 `ProfileIdentityDto` が加わった。P4 が `update_account_detail_authorized` に入れるロック処理と両立させる（`find_by_account_id` の `ORDER BY id LIMIT 1` も維持）。
- **should2（見送り）**: Profile 行が削除された後（Account projector の cascade 削除後）の無効化状態に関するテストは未追加。必要なら後続で追加する。
- 組織 Account の複数 Profile 列挙・代表の明示選択は後続課題（Profile 一覧 API を含む別 unit）。

## UA 確定契約（Emumet PR #98、2026-11-11 マージ済み、squash `6504c91`、unit `profile-username-availability-api`、Emumet#96）

計画外の追加 unit（ユーザー承認 question-66c258dd659b42f5ed0c13ae2c29fdf5）。FN（shuttlepub-frontends#34、emumet-web PR #38）の入力中検証で username の重複も判定するための読取専用 endpoint。独立 Reviewer 承認（head `6ca2512`）。

### API

- `GET /api/v1/profiles/username-availability?username=<value>`（Bearer 必須）。未認証・不正トークンは 401、`username` 欠落は 400。
- 応答は **200 `{ username, available, reason? }`**（`username` は受信値のエコー、`reason` は `available:false` のときだけ）。`reason` は `invalid_format`（`^[a-z0-9][a-z0-9._-]{0,63}$` に不適合。暗黙変換なし、`Alice`・前後空白・空文字・65 文字を含む）／`reserved`（予約語 17 語）／`taken`。
- **`taken` は「現在使用中」と「削除済み Profile が使っていて再利用不可」を区別しない**（応答のキー・値とも同一。列挙攻撃・プライバシー配慮）。
- **可用性は参考値で最終判定ではない**: 最終判定は作成/設定 API の 400／409（確認から送信までに他者が取れば 409 になりうる）。予約（ホールド）なし。username 変更は範囲外（この unit も追加していない）。description と PR に明記。

### 判定源

- 形式・予約語は `ProfileUsername::check`（P1 と同一の規則を流用、重複実装なし）。使用中／削除済みは新設の `ProfileEventStore::username_exists`（`profile_events` の `data ->> 'username'` の存在確認。部分 unique index `profile_events_username_unique` と同じ判定源で、`EXPLAIN` で index 使用を確認）。`profiles` 投影行は使わない（Account 削除で消えるため）。作成時指定（Created）と一回限り設定（UsernameSet）の両イベントが対象。
- 形式不正・予約語は DB を引かない。副作用なし（イベント・Account・auth account を作らない。`resolve_auth_account_id` を呼ばない）。migration・DependOn・AppModule の変更なし。

### レート制限

- Emumet に HTTP リクエスト単位の制限機構が無かったため **in-process の最小実装**: JWT の `(iss, sub)` 単位のスライディングウィンドウ、**60 回／分**、超過は **429 + `Retry-After`（秒、最小 1）**。超過リクエストは窓に数えない。ユーザー独立。期限切れキーは窓ごとに掃除（メモリは直近約 2 窓の生存キー数に有界）。時刻はロック取得後に採取し、保持する最新時刻より戻さない（並行・時刻逆転の回帰テストあり）。
- **インスタンス単位で複数インスタンス間では共有しない**（N インスタンスなら実効上限は最大 N 倍）。分散制限が必要なら共有ストア（Redis 等）を使う別 unit。上限・窓は定数（設定化していない）。

### 組織コンテキストの対象外

- 本 endpoint は **JWT 認証だけの router**（`root_router.rs` の `authed_without_organization_context`）に置き、`organization_context_middleware` の外。同 middleware は `X-Organization-Id` があると `resolve_auth_account_id`（find-or-create）で auth account を作るため、読取専用の契約を守るために外した。`X-Organization-Id` は無視され、既存 endpoint の middleware は不変。実 DB テストで、未登録 subject＋組織ヘッダー（既存組織・存在しない組織）でも `auth_accounts` が増えず、ヘッダー付き未認証が 401 であることを確認（修正前の router ではこのテストが失敗することも確認）。

### 検証

- 実 DB（使い捨て PostgreSQL 16）の route test（`client_username_availability_tests.rs`、7 本）: 401・欠落 400、空き／形式不正 13 値／予約語 17 語／使用中（作成時指定・一回限り設定）／削除済み（Account 無効化＋projector 相当の `profiles` 行削除後も `taken`）、**作成/設定 API との一致**（`invalid_format`・`reserved` は 400、`taken` は 409、空きは成功）、副作用なし、組織ヘッダー、429（60 回で 429・別ユーザー無影響）。limiter 単体 7 本、driver の `username_exists` 実 DB テスト。`cargo test --workspace`（kernel 251 / application 297 / driver 324 / server 206）・fmt・clippy・`openapi.json` 再生成一致。
- CI は実 job（check / driver / openapi-check / e2e / D15 / registration / coverage）がすべて pass。外部集計の `codecov/project`（と `codecov/patch`）は pending のままだったが、main は branch protection なし（必須 check なし）のため head `6ca2512` を `--match-head-commit` で固定してマージ。server の CI job は `DATABASE_URL` を持たず実 DB route test は skip されるため、実 DB 実行はローカルの使い捨て PostgreSQL のみ。

### P4（Emumet PR #91）統合注意・申し送り

- P4 は `openapi.json`・`openapi.rs`・`root_router.rs`・`route.rs`・`api/mod.rs`・`schema.rs`・`client_tests.rs`・`openapi/tests.rs` も触る。UA の変更は新規ファイル中心で共有ファイルは数行の追加だが、統合時に次を保つ: (1) `root_router.rs` の `authed_without_organization_context`（組織 context の外）と merge、(2) `openapi/tests.rs` の username ガード（空き確認 route を GET のみの例外として許容）、(3) `client_tests.rs` の `username_availability` モジュール宣言、(4) `openapi.json` は統合後に再生成（`git merge-tree` では衝突なし）。P4 側のテスト fixture 調整は P4 で対応する。
- route `/profiles/username-availability` は静的セグメントで、将来 `/profiles/{profile_nanoid}` が mount されても axum では静的ルートが優先される。
- FN（emumet-web）は 200 の `available`／`reason` で入力中表示を切り替え、429 は `Retry-After` に従って間引く（debounce 推奨）。作成/設定時の 409 は引き続き必ずハンドリングする。

## FN の BFF 部分の申し送り（shuttlepub-frontends PR #36、画面なし）

BFF・GraphQL・REST 変換・mock・生成型の先行 PR。画面（PureScript の手書きソース）は変更していない。実 Emumet（49acf9d）に対し BFF の GraphQL 経路から実接続を確認済み（作成時の保存、一回限り設定、重複 `USERNAME_TAKEN` と設定済み `USERNAME_ALREADY_SET` の区別、形式・予約語・末尾改行、401/403/404/422、移管後の username 不変）。

- **Metadata（`AccountResponse.fields`）の書込みは未対応（BFF は `createMetadata` / `updateMetadata` / `deleteMetadata` を `UNSUPPORTED` にし、何も書かない）。読取のみ**（nanoid は fields 内の位置）。理由: 上流の `PATCH /api/v1/accounts/{id}` は fields を配列ごと置換するだけで項目 ID も revision（CAS）も無く、位置指定の読み出し→置換では並行 2 更新の lost update や、他クライアントが fields を置換した後の古い画面からの誤更新を防げない。
  - **後続課題: metadata の安全な書込みには Emumet 側に項目 ID または fields の revision が必要**（別 unit）。それまで画面の Metadata 編集・追加・削除は実 Emumet 接続では使えない。
- `updateProfile` は Profile 属性（display_name / summary / icon_url / banner_url）だけを PATCH し、fields は送らない（Metadata を上書きしない）。
- `Account.publicKey` は実 Emumet が返さない（Profile モデル移行で廃止）ため、BFF は GraphQL `String!` のまま常に空文字を返す。画面 PR で Maybe 化・非表示にし schema を nullable にする。
- 旧 `/profiles`・`/metadata`・`/accounts/{id}/profile` 経路は廃止し、Account / Profile / Metadata は `AccountResponse` から組み立てる。組織 Account は `X-Organization-Id` 未対応のため BFF からは読めない（移管後の username は実 DB で不変を確認）。
- `USERNAME_CONFLICT` は 409 の重複／設定済みを再確認でも判別できない場合のコード（再確認は 409 後の現在状態であり原因の証明ではない）。
- Emumet 側の観測（未対応）: Account 名の重複は 500（`accounts_name_key`）。Profile を組織へ移管すると移管元の個人 Account は一覧から消える。

## FN 確定（shuttlepub-frontends PR #38、2026-11-11 マージ済み、squash `7498380`、unit `profile-identity-web-adaptation`、shuttlepub-frontends#34）

FN は BFF 部分（PR #36、squash `284eaa4`）と画面部分（PR #38、squash `74983800d49bbb29b522246d5912674412017642`）の 2 PR で完了し、queue completed。画面は参照モック B v3（ui-username-spec.md）に合意した構成で実装した。独立 Reviewer 承認（head `5ea5bdf`、must 0）、CI（build・screens）green、実 Emumet に対する BFF 経由 E2E は main 49acf9d（59 項目×3 回）と main 6504c91（空き確認、36 項目×3 回）で全 PASS。固定 OpenAPI は Emumet main 6504c91。

### UI 実装の要点（apps/emumet-web）

- **Account 作成**: 一覧右上の「＋」から開くモーダル（Account 名・ユーザー名・Bot）。ユーザー名は必須（`CreateAccountInput.username: String!`）で初期値は空欄・候補なし。[作成] で同じモーダルが「この ID で作成しますか？ / 後から変更できません。」の確認に切り替わる。`/accounts/new` は「モーダルを開いた一覧」への入口として残した。
- **入力中検証**: 形式・長さ・予約語をその場で判定（大文字は変換せずエラー）、入力が止まって 400ms 後にサーバーへ問い合わせ。1 行の状態表示（確認しています／✓ 利用できます／✕ 理由／空き状況を確認できませんでした［再確認］）。ボタンは「利用できます」かつ host 取得済みのときだけ有効。確認中・送信中に遅れて届いた検証応答は無視する。
- **送信時のエラー種別の画面表現**: `USERNAME_TAKEN`・`USERNAME_INVALID_FORMAT`・`USERNAME_RESERVED` は入力欄の状態表示に戻る。`USERNAME_ALREADY_SET` と設定時の判別不能 409（`USERNAME_CONFLICT`）はダイアログを閉じて保存済み状態を再取得。`ACCOUNT_RESTRICTED`・`FORBIDDEN`・`UNSUPPORTED` はバナー文言。
- **未設定の既存 Profile**: 一覧は「ユーザー名未設定」、詳細は先頭の 1 行の注意＋［設定する］から一回限りのモーダル（入力→確認）。設定後は `@name` と 🔒。強制しない。
- **@ 表記**: 一覧・詳細ヘッダは Profile の username（`@name@host`）。Account 名は Account Info の行にだけ出す（ヘッダの見出しにも使わない）。
- **モーダル**: ネイティブ `<dialog>` + `showModal()`。初期フォーカス・Tab 折り返し・背面無効・Escape（確認→入力→閉じる）・フォーカス復帰。古い応答は世代と対象 Account で照合して捨てる。入力中検証の 401 は `SessionExpired`。

### EMUMET_PUBLIC_HOST 契約

- acct の `@host` は `Query.instanceHost`（BFF の環境変数 **`EMUMET_PUBLIC_HOST` の明示設定が契約**。Emumet の `PUBLIC_BASE_URL` の host[:port] と同じ値）。`EMUMET_API_URL`（内部 API ホスト）への暗黙のフォールバックはしない。
- 未設定・形式不正は `INSTANCE_HOST_NOT_CONFIGURED`。画面は host が取れるまで確認へ進めず、「ホスト名を取得できませんでした［再取得］」を出す。mock は未設定なら `emumet.example`。BFF から Emumet の公開ホストを確かめる API は無いので、形式だけ検査し一致は検証しない（運用で `PUBLIC_BASE_URL` と揃える）。

### /help/username

- 入力欄の (?) は新しいタブで開く実リンクで、emumet-web 内の最小ヘルプページ `/help/username`（ui-username-spec.md の文言のみ）。

### 空き確認の接続と UNKNOWN

- BFF の `checkProfileUsername` は、形式・予約語を自分で判定し（違反なら上流を呼ばずレート制限を節約）、満たすときだけ UA の `GET /api/v1/profiles/username-availability` を呼ぶ。結果は `VALID / FORMAT / RESERVED / TAKEN / UNKNOWN`。上流の `invalid_format` / `reserved` / `taken` はそのまま FORMAT / RESERVED / TAKEN。
- **UNKNOWN**（429・接続不可・時間切れ・5xx・契約違反）は「✓ 利用できます」を出さず、［作成］［設定］も押せず、［再確認］を出す。**確認できなかった結果を「利用できる」として扱わない。** 上流の 401 は UNAUTHENTICATED、403 は FORBIDDEN としてエラーのまま（UNKNOWN に隠さない）。
- 可用性は参考値で確保しない。最終判定は送信時の 409（`USERNAME_TAKEN`）。実 Emumet で、VALID の後に他者が取得した場合の 409 を確認済み。レート制限（60 回/分、(iss, sub) 単位）は 61 回目から 429 になり UNKNOWN を返す（別ユーザーは影響なし）。

### publicKey 非表示・metadata 書込み

- `Account.publicKey` は nullable（BFF は常に null）で、画面は空なら「Public Key」行を出さない。
- Metadata の書込み（作成・更新・削除）は BFF で `UNSUPPORTED` のまま（読取のみ）。画面は入口を残し、押すと「この操作は現在サポートされていません」を出す。

### 引継ぎ（FN の範囲外・後続課題）

- **UNKNOWN の visual／ブラウザ検査**: 状態は hydration 検査（全 76 組合せ）と spago テストには含むが、visual のケースとブラウザ操作検査は未追加。
- **metadata の安全な書込み API**: Emumet 側に項目 ID または fields の revision が必要（別 unit）。それまで Metadata の編集・追加・削除は実接続で使えない。
- **組織 Account の複数 Profile**: 画面は代表 1 件のみ。列挙・代表の明示選択は Profile 一覧 API を含む別 unit。
- visual の 404 検出の強化は Reviewer の任意指摘で F15（登録ゲート管理画面）由来のため、FN では扱わない。
- 実 Emumet へのブラウザ UI 接続（real モードの Kratos/Hydra 経由）は FN では未実施（UI は mock データで検証）。

## UI 前提（ユーザー指示）

FN の画面構成を決める実装はモック合意まで保留する。画面構成に依存しない BFF・GraphQL・変換の検証は先行できるが、
FN の受け入れ（SSR/hydration・visual を含む画面検証）は画面構成のモック合意後に行う。
→ 合意（B v3）後に画面を実装・検証し、FN は確定した（上の「FN 確定」参照）。
