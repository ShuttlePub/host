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

## P2 確定契約（Emumet PR #77、2026-11、マージ待ち。head `e2d080b`）

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
| `profile_delivery_jobs` | 配送 job。冪等キー `(sender_profile_id, activity_id, target_inbox)`。activity 種別 `Follow`/`Accept`/`Reject`/`Undo`（AP Block は送らない）、**送信本文のバイト列そのもの**（TEXT。HTTP 署名 digest のため正規化しない）、`follow_id`、state `pending`/`in_flight`/`retrying`/`delivered`/`failed`/`cancelled`、`attempt_count`、`next_attempt_at`、lease（`lease_owner`/`lease_token`/`lease_expires_at`）、最終結果・HTTP status・失敗理由、取消理由 |
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

## UI 前提（ユーザー指示）

FN の画面構成を決める実装はモック合意まで保留する。画面構成に依存しない BFF・GraphQL・変換の検証は先行できるが、
FN の受け入れ（SSR/hydration・visual を含む画面検証）は画面構成のモック合意後に行う。
