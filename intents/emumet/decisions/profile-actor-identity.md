# Profile actor identity: Profile 単位の username・actor URI・鍵の所有主体と一回限り設定

- Status: Accepted (2026-11-10、設計方針。実装確定値は P1 `profile-actor-identity-foundation`（[Emumet#71](https://github.com/ShuttlePub/Emumet/issues/71) / PR #78）の closeout で下記「確定値」へ write-back 済み)
- Deciders: operator（D08 grill `d08-q13`〜`d08-q15`、計画 thread-xxs52dcx）
- 関連 unit: E8 `profile-domain-policy-api-contract`（契約）、P1 `profile-actor-identity-foundation`（本 ADR の実装）、P4 `profile-federation-in-place-cutover`（切替・username 必須化。ADR `profile-federation-in-place-reset` は P4 で新設）

## Context

- [ADR 0002](0002-account-address-on-emumet-domain.md)（2026-08-24 amend）は「AP actor は Account ではなく Profile 単位、1 Profile = 1 actor」を採用済みだが、実装は Account = actor のまま未追従である（署名鍵 `signing_keys.account_id`、`/ap/accounts/...`、`/internal/v1/accounts/{id}/sign`）。
- [ADR 0003](0003-delegated-signing.md) は署名鍵を Profile ごとに生成・保管し、署名 API を狭い形に限定する方針を定めている。
- [ADR 0007](0007-organization-accounts.md) は組織 Account を導入し、移管は Account 変換ではなく Profile 単位（`profile-transfer`）で行うと定めている。
- D08（Profile 単位の domain block/mute）の grill で、(q14) 旧 Account 単位の連合 identity は引き継がず新 Profile actor から始めること、(q15) Profile ごとに一意で不変の username を新設し、移管後も actor URI・鍵・関係とともに維持することが決まった。
- 現状 Profile は username を持たず、acct の名前部分は Account 名に由来する。

## Decision

### 1. Profile の username

- username は **Profile ごとに一意**で、**Account 名とは独立**した値（Account 名から自動導出しない）。acct の名前部分になる。
- 形式 `^[a-z0-9][a-z0-9._-]{0,63}$`（ASCII 小文字 1〜64 文字）。暗黙の trim・小文字化は行わない。予約語: `admin`, `administrator`, `root`, `system`, `support`, `security`, `moderator`, `api`, `ap`, `auth`, `oauth`, `oauth2`, `login`, `logout`, `register`, `settings`, `well-known`。
- 一意性は DB 制約で保証する。削除済み Profile の username は再利用しない。
- **一度決めたら変更しない**。未設定の Profile に所有者が一度だけ設定できる（既存 Profile 向け）。通常の編集機能（PATCH 等）では公開しない。
- 段階導入: E8（契約・optional・指定時は副作用前に 501）→ P1〜P3（optional のまま実保存）→ FN（UI が必ず送信）→ P4 以後 required。

### 2. actor URI・鍵の所有主体

- AP actor の識別子（actor URI、acct）と署名鍵の所有主体は **Profile** とする。Account は actor ではない（ADR 0002 の amend を実装で確定する）。
- Profile を移管（ADR 0007 / `profile-transfer`）しても、username・actor URI・鍵・フォロー関係は変わらない。変わるのは Profile の所有主体（管理権限）だけ。
- 将来 actor の URL は `GET /ap/profiles/{profile_nanoid}`（E8 で契約化、最終形は P1 で確定）。外部 ID は nanoid。
- 鍵は Profile 単位に新規生成する。旧 Account 単位の鍵・actor URI・フォロー関係は変換しない（q14）。旧連合データの初期化と新 Profile 鍵の一回限り生成は P4 が所有する。P1 は鍵の型と repository を用意するが、username 設定を除き新 actor・鍵の本番生成は開始しない。

### 3. P1 の境界

- 含む: username の実保存・一回限り設定、Profile actor 情報・鍵の型と repository、WebFinger／actor 文書の生成ロジック、実 DB 検証。
- 含まない: 本番 Profile actor 公開（`/ap/profiles/...` は本番 root router 未 mount、新配送 worker はルートで起動しない）、新しい汎用署名 API、旧 identity 変換。mount・旧 route（`/ap/accounts/...`、`/internal/v1/accounts/{id}/sign`、`.../public-key`）撤去・worker 起動は P4。migration は、P1 の非破壊の追加 migration（username 列・Profile 鍵テーブル・index）は通常の `migrations/` に置き本番適用してよく、P4 が所有するのは旧連合データ初期化などの破壊的 migration と P2 の新関係・配送テーブルの本番採番（親判断 2026-11-10。[profile-federation-in-place-reset](profile-federation-in-place-reset.md) 参照）。

## Consequences

- ADR 0002 は「Profile = actor」の方針から、username・actor URI・鍵の所有主体まで実装・DB 制約で確定する。ADR 0002 の本文は変更しない（本 ADR が実装確定値を記録する）。
- ADR 0003 の署名鍵 Profile 単位保管は P1 の鍵 repository で型として具体化される。署名 API の形（狭い入力）は変えない。
- ADR 0007 の「移管は Profile 単位」と整合し、移管で identity が変わらないことを P1 の移管テストで検証する。
- username は不変・再利用なしのため、誤設定を後から直せない。UI（FN）は変更不可の説明と確認を示す必要がある。
- 実 identity の本番切替までの間は新旧が共存する（旧 Account 単位 route が本番、Profile 単位は未 mount）。

## 確定値（P1 実装、Emumet [PR #78](https://github.com/ShuttlePub/Emumet/pull/78)、squash `e2e3b46`、2026-11-10）

詳細な契約と検証は [PF acceptance の「P1 確定契約」](../features/profile-federation/acceptance.md)。

- **actor URL の最終形**: `{PUBLIC_BASE_URL}/ap/profiles/{profile_nanoid}`（actor id・`url`・`publicKey.owner`）。inbox / outbox / followers / following は末尾 `/inbox` `/outbox` `/followers` `/following`、key id は `{actor id}#main-key`。path は username ではなく nanoid（不変の Profile identity 由来なので移管で変わらない）。acct は `username@{PUBLIC_BASE_URL の host[:port]}`。Profile は username と有効な鍵を両方持って初めて actor／WebFinger が解決する。本番 router へは未 mount（P4 が mount）。
- **Profile 鍵の保存形式・所有主体**: 新テーブル `profile_signing_keys`（`profile_id` 所有、Profile 行削除で cascade）。アルゴリズム・暗号化形式は既存 `signing_keys` と同一（RSA2048、Argon2 + AES-GCM の JSONB）。非失効鍵は Profile あたり 1 つ（部分 unique index）。所有主体は Profile（Account ではない）で移管で変わらない。P1 は型・repository・use case のみで、本番コードは鍵を生成しない（P4 が一回限り生成）。
- **username 一回限り設定の競合規則**: 一意（削除済み Profile の username も再利用不可）・一回限りは、追記専用の `profile_events` の部分 unique index（`data->>'username'` と `id`）で DB 保証し、違反は `Concurrency` → HTTP 409。設定 API は `POST /api/v1/profiles/{profile_nanoid}/username`（所有者のみ。400 形式・予約語 / 403 / 404 / 409 設定済み・重複・認可後の所有者変更 / 422 Account 停止中）。更新 API は作らない。
- **移管・通常編集との関係**: 設定は write transaction 先頭で Profile 行を `FOR NO KEY UPDATE` し、認可した所有者を再確認する（移管の projection UPDATE と直列化。D8P の `FOR SHARE` 所有者判定とも競合する）。projection の username 書込は NULL→値のみの単調更新（`COALESCE`）で、username を観測できなかった通常編集が保存済み username を消さない。
- **イベント再適用での扱い**: `Created.username`（任意、旧イベントはキー自体が無い）と `UsernameSet` の fold で復元される。`UsernameSet` を 2 回 apply するとエラー（DB の unique index により 2 つ目のイベントは保存されない）。projector の全再構築で同じ username になる。
- **migration**: `20261105000001_profile_username_and_actor_keys.sql` は非破壊の追加で通常の `migrations/` として本番適用される。P4 は再採番しない。

## Links

- [ADR 0002](0002-account-address-on-emumet-domain.md) / [ADR 0003](0003-delegated-signing.md) / [ADR 0007](0007-organization-accounts.md)
- [profile-federation](../features/profile-federation/overview.md)（PF、primary）/ [personal-domain-controls](../features/personal-domain-controls/overview.md)（DC）
- `intents/shuttlepub/packets/candidates.md` D08 節、grill `d08-q13`〜`d08-q15`
- packet: `.intent-cli/issues/profile-actor-identity-foundation/`、issue: [Emumet#71](https://github.com/ShuttlePub/Emumet/issues/71)
