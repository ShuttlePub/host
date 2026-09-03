# 0007: Organization accounts: Account kind 判別 + メンバーシップ CRUD + 組織ロールは DB 直接判定 (Keto Organization namespace は新設しない)

- Status: Accepted (2026-09-02)
- Deciders: operator (org-accounts grill 2026-08-29 で確定設計 Q1-Q11)、
  design / orchestration (org-accounts-foundation execution unit)。
  実装確定値は Emumet issue #55 / PR #56 (2026-09-01 squash merge `d01d424`) の
  closeout から write-back

## Context

[features/org-accounts/overview.md](../features/org-accounts/overview.md) の
確定設計 (grill Q1-Q11) に基づく execution unit 1 `org-accounts-foundation`
の設計判断と、実装 (PR #56、41 files / +3540) を通じて確定した細部を記録する。

- 複数の個人 Account が 1 つの組織 Account を共同運用する要件 (企業・団体の
  公式アカウント)。Profile : Account = N:1 は維持 (ADR 0002)
- メンバーシップは初出の中間テーブルであり、永続化様式 (ES vs CRUD) と
  権限判定の置き場 (Keto vs DB) が未決定だった
- `accounts` テーブルに種別列がなく、個人/組織の判別手段が存在しなかった

## Decision

### 1. Account kind 判別: `accounts.kind` 列 + `AccountEvent::Created.kind` (serde デフォルトで後方互換)

- `accounts` に `kind TEXT NOT NULL DEFAULT 'personal'` を追加し
  `CHECK (kind IN ('personal', 'organization'))` を付与
  (migration `20260901000001_add_account_kind.sql`)。既存レコードは
  DEFAULT により自動的に `'personal'` に backfill される
- kernel entity は `AccountKind { #[default] Personal, Organization }`
  (`#[serde(rename_all = "snake_case")]`、kernel/src/entity/account/kind.rs)
- **AccountEvent 後方互換の確定値**: `AccountEvent::Created` に
  `#[serde(default)] kind: AccountKind` を追加。kind を持たない既存イベントは
  serde デフォルト (`AccountKind::default() == Personal`) でデシリアライズ
  されるため、既存 account_events ストリームの rewrite / backfill は不要
- 組織 Account は `Account::create_organization` 相当の専用 factory でのみ
  作成する。kind=personal の Account を organization に変えるコード経路
  (API・イベント) は存在しない (移管は Account 変換ではなく Profile 単位 —
  unit 3 `profile-transfer`)

### 2. メンバーシップは CRUD 永続化 (ES なし) — `organization_members` テーブル

AuthAccount (ADR 0006 決定8) と同じく、履歴価値が現時点でないため CRUD で
開始する。将来の連合要件 (リモートアカウント加入) 時に ES 化を再検討する。

確定テーブル形状 (migration `20260901000002_add_organization_members.sql`):

- 列: `org_account_id BIGINT` / `member_account_id BIGINT` / `role TEXT` /
  `status TEXT` / `invited_by BIGINT` / `created_at TIMESTAMPTZ DEFAULT now()`
- PK: `(org_account_id, member_account_id)` 複合
- CHECK: `role IN ('owner','admin','member')`、
  `status IN ('pending','active')`
- FK ×3 (org_account_id / member_account_id / invited_by → accounts.id)、
  全て `ON DELETE CASCADE`
- index: `idx_organization_members_member_account_id` (member_account_id)
  — 「自分の所属組織一覧」の検索列

対応 entity は `OrganizationMembership { org_account_id, member_account_id,
role: OrgRole, status: OrganizationMembershipStatus, invited_by, created_at }`
(plain struct、EventVersion なし)。ロールは `OrgRole { Owner, Admin, Member }`、
状態は `OrganizationMembershipStatus { Pending, Active }`。

**closeout 学び**: packet の acceptance criteria はテーブル形状を
status なしで記述していたが、招待が「Pending 作成 → accept で Active 確定」の
2 段階フローのため `status` 列が実装で必要になった。招待フローを持つ
メンバーシップテーブルの形状は `(org, member, role, status, invited_by,
created_at)` が確定値

repository port は CRUD 系統
(`kernel/src/repository/organization_membership.rs`
`OrganizationMembershipRepository` + `DependOn*`):

- `create` / `find` / `find_by_org` / `find_by_member` / `update_role` /
  `update_status` / `delete`
- last-owner 判定用: `count_active_owners` / `lock_active_owner_rows`
- read 側は `OrganizationMembershipQuery` (kernel/src/read_model/) に分離

### 3. 組織ロール判定は DB 直接クエリ。Keto に Organization namespace は新設しない

- メンバーロール判定は `organization_members` テーブルへの直接クエリで行う
  (service 内で membership を find し role を評価)
- 既存の Keto Account namespace (owners/editors/signers) は**個人 Account
  リソースのまま維持**し、組織 Account への generalized 化は行わない
- Keto 側に組織ロールの relation tuple を二重管理する同期回線・齟齬検知の
  コストを避け、単一情報源 (DB テーブル) に閉じる判断。連合要件で組織ロールを
  リソーススコープの権限として再利用する必要が生じた時点で namespace 追加を
  再検討する

### 4. review で確定した設計細部 (PR #56 closeout より)

- **既存 GET /accounts との分離**: `application/src/service/account/read.rs`
  `GetAccountUseCase::get_all_accounts` が `kind == AccountKind::Personal`
  filter を適用し、既存の自分の Account 一覧に組織 Account が混ざらない。
  組織一覧は専用の `GET /api/v1/me/organizations` で取得する
- **last-owner ガードの同一 tx 化**: Owner 降格 (change_role) と Owner 脱退
  (leave) では、`lock_active_owner_rows` (`FOR UPDATE` で active owner 行を
  ロック) → `count_active_owners == 1` なら `Rejected` を**同一
  transaction 内**で実行する。count → update/delete が別 tx だと同時操作で
  「最後の Owner が消える」競合を通しうるため、review 指摘を受けて
  lock+count を UoW (TransactionManager::transaction) 内に閉じた
- **`invited_by` の外部表現は nanoid**: API レスポンス
  (`OrganizationMemberResponse.invited_by`) では内部 BIGINT id ではなく
  招待者 Account の nanoid (String) を返す。パラメータの org / account_id も
  全て nanoid 経由で、内部 id は API surface に露出しない

### 5. API surface 確定値とエラーマッピング

- `POST /api/v1/organizations` (201、作成者の初回メンバーシップは
  Owner + Active で即座に確定。招待経路のみ Pending 開始) /
  `GET /api/v1/me/organizations` /
  `GET /api/v1/organizations/{org}/members` /
  `POST .../invites` (role: admin|member、Owner 招待は Rejected 422) /
  `POST .../invites/{account_id}/accept` /
  `PUT .../members/{account_id}/role` (Owner のみ) /
  `DELETE .../members/{account_id}` — **脱退と除名の共用エンドポイント**で、
  handler はまず leave を試行し `PermissionDenied` なら remove にフォールバック
  する。除名は Owner/Admin 可・Owner 除名不可 (Rejected)、脱退は最後の
  active Owner 不可 (Rejected)
- エラーマッピングは既存共有 `ErrorStatus` マッピングに乗せる:
  `PermissionDenied → 403` / `NotFound → 404` / `Rejected → 422` /
  不正入力 → 400。非メンバーのメンバー管理 API 呼出しは 403、存在しない
  組織/メンバーは 404
- 権限評価は「認証 AuthAccount にリンクした非削除 personal Account のうち
  Active メンバーシップを持つもの」を actor として走査する形に確定
  (1 AuthAccount が複数 personal Account を持ちうる前提)

### 6. スイッチ式認証: X-Organization-Id による組織コンテキスト解決 (unit 2 確定、2026-09-02、PR #58 より)

unit 2 `org-accounts-auth-context` (Emumet issue #57 / PR #58、squash merge
`c33fe53`) で確定した設計細部。grill Q4 (スイッチ式認証) の実装。

- **ヘッダ契約**: `X-Organization-Id` (server/src/auth.rs
  `ORGANIZATION_ID_HEADER`) に組織 Account の **nanoid** を指定する。
  未指定リクエストは現行通り個人コンテキスト (後方互換)
- **middleware による解決**: `organization_context_middleware`
  (server/src/api/organization_context.rs) が header を読み、auth 解決済みの
  AuthClaims → AuthAccountId を経て `resolve_organization_context`
  (server/src/api/mod.rs) を呼び、結果を
  `RequestOrganizationContext(Option<OrganizationContext>)` として request
  extensions に挿入する。`SessionContext` (application/src/service/
  session_context.rs) は `org_context: Option<OrganizationContext>` を持ち、
  `GET /api/v1/me/session-context` の応答に org_context が含まれる
- **404 → 403 の順序**: `resolve_organization_context` はまず指定 nanoid の
  Account を引き `kind == Organization` でなければ `NotFound` (404)、
  存在が確定した後に actor の Active メンバーシップを走査し、なければ
  `PermissionDenied` (403) とする。**存在確認が権限確認に先行する**順序で確定
  (org 存在は nanoid 知識で観測可能だが、非メンバーには role を含む
  コンテキストを返さない方針)
- **membership 判定は OrgRole 直接クエリ (Keto 非適用)**: コンテキスト解決は
  `OrganizationMembershipRepository::find` による DB 直接クエリで role を取得し
  `OrganizationContext` に格納する。Keto check は呼ばない (決定3 の確定)。
  組織コンテキストでの既存 Profile 更新経路
  (account_detail/update.rs `update_account_detail_in_context`) も Keto
  `account_edit` permission check を**呼ばず**、
  `check_organization_account_edit` (org context が対象 Account の owner かの
  一致チェック、不一致は 403) でゲートする。Member 以上の担保はコンテキスト
  解決時の Active membership 必須で行う 2 層構成 (member ロール自体の再評価は
  更新経路では行わない)
- **org nanoid round-trip 契約の実装形**: `OrganizationContext` は
  `org_account_id` (内部 BIGINT) に加えて **`org_account_nanoid: String`**
  を保持し、session-context 応答と組織 Profile 作成応答は nanoid を返す。
  内部 id を API surface に出さない決定4 の契約をコンテキスト経路でも
  維持する (review repair で追加: `OrganizationContext.org_account_nanoid`
  を resolve 時に格納し、応答 DTO は nanoid を返却)
- **組織 Profile 作成の 1:1 制約**: `CreateOrganizationProfileUseCase`
  (application/src/service/profile.rs) は `ProfileQuery::find_by_account_id(
  org_account_id)` が既存なら `Rejected` ("Organization profile already
  exists") → 422。`profiles.account_id` UNIQUE は維持 (組織でも Profile は
  1:1 — unit 1 packet の N:1 維持方針を組織では 1:1 に狭めて確定)
- UoW: org Profile 作成は `TransactionManager::transaction` 内で
  ES save (Profile Created) + 同期 read model 書込みを同一 tx で行う
  (Profile 集約の既存パターンに準拠)

### 7. Profile 移管: 2段階フロー + 所有移転イベント + 参照ファイルコピー port (unit 3 確定、2026-09-04、PR #62 より)

unit 3 `profile-transfer` (Emumet issue #61 / PR #62、squash merge `a34f524`) で
確定した設計細部。grill Q6 (Account 変換経路なし) / Q7 (2段階フロー) /
Q9 (参照ファイルコピー) の実装。構造は AccountReport と同型の
ES aggregate + tailing projector パターン (AC1)。

- **永続化**: ES イベントテーブル `profile_transfer_request_events`
  (id, version, event_name, JSONB data, seq — tailing projector 用 seq index) +
  read テーブル `profile_transfer_requests` (status / version / nanoid UNIQUE)。
  状態は `pending → accepted / rejected / cancelled` (grill Q7 確定通り、
  承認前の取消のみ可で受理後の取消・却下は Rejected 422)
- **route shape (nanoid ベース、決定4/6 と整合)**: 申請
  `POST /api/v1/profiles/{profile_nanoid}/transfer-requests` (移管元個人、
  移管先は自分がメンバーの org のみで 404/403)、応答
  `POST /api/v1/profile-transfer-requests/{request_nanoid}/{accept|reject|cancel}`。
  承認・却下は移管先 org の Owner/Admin が個人 identity + メンバーロールの
  DB 直接判定で行う (決定3 通り Keto 不呼出)
- **承認 = 所有移転イベント**: accept 時に同一 tx で Profile aggregate に
  `ProfileEvent::AccountTransferred` を保存し read model を同期更新する。
  acct / Actor URI / nanoid / 署名鍵 / フォロー関係は不変 (AC4)。
  移管元個人は移管後に新規 Profile を作成可能 (AC5)
- **owner_kind + partial unique index (AC6)**: `profiles` に
  `owner_kind TEXT NOT NULL DEFAULT 'personal'` を追加し accounts.kind で
  backfill。`profiles.account_id` の全件 UNIQUE は削除し
  `profiles_personal_account_unique ON (account_id) WHERE owner_kind='personal'`
  に置換 (migration `20260904000001_profile_transfer.sql`)。個人 1:1 は DB
  制約で維持しつつ、組織は複数 Profile を所有可能になった。**これに伴い
  決定6 の「組織 Profile 作成は 1:1 に狭める app-level チェック」は
  supersede され、`CreateOrganizationProfileUseCase` の "already exists"
  Rejected チェックは除去済み** (unit3 AC6)。**closeout 学び** (packet
  closeout_learning の問いへの回答): partial unique index の実定義は
  `CREATE UNIQUE INDEX ... WHERE status = 'pending'` / `WHERE owner_kind =
  'personal'` の 2 本で、アプリの Rejected と DB 制約の二重担保とした
- **重複 pending の一意性**: read テーブル側に
  `profile_transfer_requests_one_pending_per_profile ON (profile_id)
  WHERE status='pending'` を敷き、移管中の同一 Profile への重複申請は
  app 側で Rejected (422) (AC8)
- **参照ファイルコピー port (AC7)**: `ProfileMediaCopyGateway::request_copy(
  ProfileMediaCopyRequest { from_account_id, to_account_id, image_ids })`
  (kernel/src/storage.rs) — packet closeout_learning の問い「コピー port の
  確定シグネチャ」への回答。accept の transaction 完了**後に**呼び出し、
  失敗は `tracing::warn!` に留める **fail-open** (所有移転の成否とコピーを
  分離)。icon / banner の ImageId が存在する場合のみ発行。現行実装は
  `NoopProfileMediaCopyGateway` (driver/src/storage.rs) の stub で、
  Booskiff コピー API 実連携は後続 packet (grill Q9 の Booskiff 側要件)
- **review で検出された既知事項 (後続 cleanup 候補)**: duplicate pending race
  で DB partial unique 違反が 500 として表面化しうる経路の残存、
  test_mode の TRUNCATE リストに `profile_transfer_requests` /
  `profile_transfer_request_events` が未追加 (organization_members と同じ
  運用債務、Consequences 参照)、dead_code helper 2 件

## 却下案と理由

- **Keto Organization namespace の新設 (組織ロールを relation tuple で管理)**
  - 理由: DB テーブルとの二重管理・同期齟齬の回線コストに対し、現状の
    ユースケース (server 内でのロール判定のみ) では利益がない。
    連合要件時に再検討する (上記決定3)
- **メンバーシップの Event Sourcing**
  - 理由: 現時点で履歴の業務価値がなく (AuthAccount と同型)、CRUD の方が
    素直。`AccountEvent` とは独立性が高く、ES 化は連合要件時の検討事項
- **personal → organization の Account 変換経路**
  - 理由: 移管は Account 変換ではなく Profile 単位の 2 段階フロー
    (unit 3 `profile-transfer`) として設計確定済み。変換経路を持つと
    auth_account リンク・Profile 所有・Keto relation の一貫した移行が
    必要になり、境界が曖昧になる

## Consequences

- unit 2 `org-accounts-auth-context` は本 ADR の基盤 + 決定6 として着地済み
  (2026-09-02)。unit 3 `profile-transfer` も決定7 として着地済み (2026-09-04)。
  組織は複数 Profile を所有可能になり (owner_kind partial unique)、参照
  ファイルコピーの実連携 (Booskiff copy API、Noop stub の置換) と
  test_mode TRUNCATE 追加・dead_code cleanup は後続 packet の論点
- 組織 Account は Account 集約・projection・モデレーション (通報/Suspend/Ban)
  の既存経路にそのまま乗る。Profile の AP actor 型は現行 Person のまま維持
  (Organization actor 型への対応は将来検討、packets.md 残スコープ参照)
- e2e / test_mode の TRUNCATE リスト等の運用面に `organization_members` を
  含める必要がある (Account 従属テーブルとして)
- 組織コンテキストを解釈する既存エンドポイントは opt-in 拡張
  (`RequestOrganizationContext` 既定 None) のため、未対応エンドポイントは
  従来通り個人コンテキストとして動作する。新規エンドポイントで org context を
  受ける場合は extensions からの取得と 2 層構成 (Active membership + 所有
  一致) の踏襲が必要

## Links

- [features/org-accounts/overview.md](../features/org-accounts/overview.md)
  「確定設計」(grill Q1-Q11)
- [features/org-accounts/packets.md](../features/org-accounts/packets.md) —
  unit 1 `org-accounts-foundation`
- [interview/2026-08-29-org-accounts-grill.md](../interview/2026-08-29-org-accounts-grill.md)
- Emumet [issue #55](https://github.com/ShuttlePub/Emumet/issues/55) /
  [PR #56](https://github.com/ShuttlePub/Emumet/pull/56)
  (2026-09-01 squash merge `d01d424`、unit 1)
- Emumet [issue #57](https://github.com/ShuttlePub/Emumet/issues/57) /
  [PR #58](https://github.com/ShuttlePub/Emumet/pull/58)
  (2026-09-02 squash merge `c33fe53`、unit 2 — 決定6)
- Emumet [issue #61](https://github.com/ShuttlePub/Emumet/issues/61) /
  [PR #62](https://github.com/ShuttlePub/Emumet/pull/62)
  (2026-09-04 squash merge `a34f524`、unit 3 — 決定7)
- 実装参照: kernel/src/entity/organization_membership.rs、
  kernel/src/repository/organization_membership.rs、
  application/src/service/organization/{create,list,membership}.rs、
  server/src/{route,api,schema}/...organization.rs、
  migrations/20260901000001_add_account_kind.sql /
  20260901000002_add_organization_members.sql
