# Profile federation in-place reset: 旧連合データの初期化・旧 API 廃止・切替手順・再実行防止

- Status: Accepted (2026-11-10、設計方針。実装確定値は P4 `profile-federation-in-place-cutover`（Emumet issue 番号は host の PF packets を参照）の closeout で write-back する)
- Deciders: operator（D08 grill `d08-q13`〜`d08-q15`、計画 thread-xxs52dcx。migration の分担は親判断、2026-11-10）
- 関連 unit: P2 `profile-social-graph-storage`（保存モデルと初期化 fixture、マージ済み）、P1 `profile-actor-identity-foundation`（[ADR profile-actor-identity](profile-actor-identity.md)）、P3o/P3i（送受信、本番未接続）、FN（username UI）、P4（本 ADR の実装・本番切替）、D8G/D8R（切替後の domain 方針適用・block 解除）

## Context

- 現状の連合は Account 単位（actor `/ap/accounts/{id}`、署名鍵 `signing_keys.account_id`、`/internal/v1/accounts/{id}/sign`・`.../public-key`、`follows`/`blocks`/`mutes`/`remote_accounts`/`outbox_activities` が Account 基準）。[ADR 0002](0002-account-address-on-emumet-domain.md) の「AP actor は Profile 単位」には未追従。
- D08 grill `d08-q14` で、本番利用者・remote follower が未だいないため旧 Account 単位の連合 identity とフォロー関係は**引き継がず新 Profile actor から開始**し、Move・リダイレクト・互換維持は不要、**DB 全消去ではなく旧連合 identity に属するデータだけを初期化**すると決まった。`d08-q15` で Profile ごとの一意な username を Account 名と分けて新設する。
- P1〜P3 の新機構は P4 まで本番 root router に mount せず、新配送 worker も root で起動しない。稼働する actor・保存モデルは常に一種類で、旧新の同時公開・dual-write・機能フラグによる旧新切替は行わない。

## Decision

### 1. 方式: in-place reset（変換しない）

- 旧 Account 単位の連合データを**新モデルへ変換・コピー・dual-write しない**。対象を限定した versioned SQL で初期化し、同じ DB を Profile モデルへ切り替える。
- 専用の移行フレームワークは作らない。構成は「対象限定の versioned migration」「一回限りの鍵初期化」「停止・再開手順」だけ。
- 旧 identity を保存・保持するテーブル／コード・互換 Follow API・Move／リダイレクト・無停止移行は作らない。

### 2. 初期化対象と非対象（P2 確定契約が正本）

正本は [PF acceptance の「旧連合データの初期化」](../features/profile-federation/acceptance.md)（P2 の `driver/fixtures/profile_social_graph/02_reset_legacy_federation.sql`）。P4 はこの SQL をそのまま versioned migration として本番 `migrations/` に採番・配置する。

- **対象**（`TRUNCATE TABLE` で明示列挙、`CASCADE` を使わない）: `follows`、`blocks`、`mutes`、`remote_accounts`、`outbox_activities`、`signing_keys`（旧 Account 連合鍵）。
- **非対象（保持）**: `auth_hosts`、`auth_accounts`、`auth_emumet_accounts`、`accounts`、`profiles`、`metadatas`、`images`、`organization_members`、`profile_transfer_requests`（+events）、`account_events`、`profile_events`、`metadata_events`、`account_report_events`、`account_reports`、`registration_gate_*`、`projection_checkpoints`、`profile_domain_controls`（D8P。Profile に付く利用者設定）、新モデル（`profile_follows` 等）の全テーブル、P1 の username 列・`profile_signing_keys`。
- 対象を参照する外部キーが非対象テーブルにあれば `TRUNCATE` は失敗させる（黙って巻き込まない）。失敗時は全体 rollback で何も消えず、台帳も残らない。
- 旧リモート icon の孤児 `images` は残りうる。掃除の要否は P4 が判断する（共有資産なので既定は保持）。

### 3. migration の分担（親判断、2026-11-10）

- P1・D8P のような**非破壊の追加 migration（列・テーブル・index の追加）は通常の `migrations/` に置き、本番適用してよい**。D8P の `20260920000001_profile_domain_controls.sql` は既に本番 `migrations/` にある。
- P4 が所有するのは、**旧連合データの初期化などの破壊的 migration**と、**P2 の新関係・配送テーブルの本番採番**（`01_...` schema fixture の配置）。
- 破壊的 migration は、起動時に自動適用される `migrations/` の仕組み上、新バイナリの起動が実行トリガになる。したがって適用は「旧プロセスを停止してから新バイナリを起動する」手順（後述）と、ユーザー確認ゲートを前提にする。

### 4. 一回限り・再実行防止

- 台帳テーブル `profile_federation_resets` に `legacy-account-federation-v1` を記録し、**確認と消去を同一 transaction** で行う。再実行（再起動・再 migrate・手動再適用）しても再消去せず、初期化**後**に作られたデータは消えない。
- 新 Profile 鍵の生成も一回限り: 鍵を持たない Profile にだけ生成し、既存鍵を再生成・上書きしない（P1 の `profile_signing_keys` の一意制約と生成手順の冪等性で担保）。再実行しても鍵は変わらない。
- 「再実行で何も変わらない」ことを実 DB で検証する（行数・内容 hash の前後照合）。

### 5. 新 Profile 鍵の一回限り生成

- 対象は全既存 Profile（初期化で消えるのは旧 Account 連合鍵だけで、Profile は保持される）。保存先は P1 の `profile_signing_keys`。旧 `signing_keys` からの鍵変換はしない（q14）。
- 公開鍵は**新 actor 文書**（`{PUBLIC_BASE_URL}/ap/profiles/{nanoid}`）から取得させる。**汎用 Profile 署名 REST API を代替として追加しない**（署名は配送 worker 内の内部処理に限る。ADR 0003 の鍵所有境界を保つ）。
- 生成のタイミング（migration 内か、切替手順の初期化ステップか、初回アクセス時か）は P4 が決める。ただし「切替後に鍵のない Profile が存在しない」ことと上の一回限り規則を満たすこと。

### 6. 旧 API・route の廃止

- 旧 `/ap/accounts/{account_id}`（actor・inbox・outbox・followers・following）は**廃止応答**を返す。**新 actor へ redirect しない**（旧 identity を引き継がない決定 q14）。
- `/internal/v1/accounts/{id}/sign` と `.../public-key` は**廃止**。正当な認証でも署名・旧鍵取得ができない。
- Account 単位の旧 Follow／unfollow／block／unblock／mute／unmute とその一覧・followers/following の経路は廃止し、Profile 単位の API（E8 契約、`/api/v1/profiles/{profile_nanoid}/...`）に置き換える。**Account 管理 API（作成・取得・更新・無効化等）は維持**する。
- 旧 route の撤去対象の最終一覧は P4 が実装時にコードで確認して closeout に記録する。

### 7. 切替手順（制約。詳細手順は P4 が runbook 化）

1. **前提確認**: FN がマージ済みで、全既存 Profile の username が設定済みであることを確認する。未設定が 1 件でも残れば**切替を拒否**する（検査は migration の前提検査として abort させる方式が自然。実装は P4 が選ぶ）。
2. **旧機構の停止**: 旧 inbox・Account 単位の関係書込・旧配送 worker が停止している状態で切り替える（新バイナリの起動前に旧プロセスを止める）。
3. **破壊的 migration と P2 schema の本番適用**（初期化＋台帳を同一 transaction。失敗は全体 rollback）。
4. **新 Profile 鍵の一回限り生成**。
5. **root router・worker の切替**: Profile route・WebFinger・inbox・E8/D8P の未 mount route を本番 root router に mount、旧 route を撤去、新配送 worker を起動。**P1 が切り出す `server/src/root_router.rs`（本番と検査が共有する router 構築）上で**mount・未 mount を検査する。
6. **スモーク確認**（WebFinger・actor 文書・署名付き Follow・E2E）。
- **ユーザー確認ゲート**: P4 のマージと本番切替は不可逆な初期化を含むため、**実行前に必ずユーザー（operator）の確認を得る**。確認なしにマージ・切替しない。

### 8. username 必須化

- P4 で作成 API（`POST /api/v1/accounts` の `profile_username`、`POST /api/v1/profiles` の `username`）の省略を validation error とし、OpenAPI も required に変更する。username は引き続きアカウント名から自動導出しない。
- DB の NOT NULL 化は、未設定ゼロの確認後に P4 が判断する。

### 9. 逆変換は保証しない

- 新運用開始後に旧 Account 単位モデルへ戻す逆変換・ロールバックは**保証しない**。初期化前の旧連合データの復元が必要な場合は、切替前のバックアップから行う（本番利用者・remote follower が未だいない前提のため、運用上の復元要件は想定しない）。

## Consequences

- 切替は一度きりの破壊的操作で、PF acceptance の「再実行しても再消去・鍵再生成が起きない」が安全弁になる。誤って旧データを消す被害は、対象列挙・CASCADE 禁止・外部キー検査・非対象の自動照合テスト（P2 検証済み）で抑える。
- 既存の E2E（mock peer・Iceshrimp・Mastodon、`.github/workflows/e2e.yml`／`e2e/run-ap-e2e.sh` と `server/tests/e2e_ap_*.rs`）は旧署名 endpoint を使っているため、新 Profile モデルに合わせて更新する（削除・skip は不可）。
- D8R（block の関係解除・公開 API 接続）は P4 の root router 一括 mount 後に block 書込を有効化する。D8G は P4 前でも隔離構成で検証できる。
- ADR 0002/0003/0007 の本文は変更しない。本 ADR と [profile-actor-identity](profile-actor-identity.md) が実装確定値を記録する。

## Open（P4 closeout で確定して本 ADR に追記）

- 破壊的 migration の最終ファイル名・番号、P2 schema fixture の本番配置形
- 新 Profile 鍵の生成タイミング・冪等性の担保方式
- 前提検査（username 未設定の拒否）の実装方式と拒否時の運用
- 旧 route 撤去の最終一覧と廃止応答の形（status・本文）
- 切替 runbook（停止・起動順・スモーク項目）と、ユーザー確認の記録場所

## Links

- [ADR 0002](0002-account-address-on-emumet-domain.md) / [ADR 0003](0003-delegated-signing.md) / [ADR 0007](0007-organization-accounts.md) / [profile-actor-identity](profile-actor-identity.md)
- [profile-federation](../features/profile-federation/overview.md)（PF、primary）/ [acceptance（P2 確定契約・旧連合データの初期化）](../features/profile-federation/acceptance.md) / [personal-domain-controls](../features/personal-domain-controls/overview.md)（DC）
- `intents/shuttlepub/packets/candidates.md` D08 節、grill `d08-q13`〜`d08-q15`
- packet: `.intent-cli/issues/profile-federation-in-place-cutover/`
