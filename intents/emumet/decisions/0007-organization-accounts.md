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

- 後続 unit の基盤: unit 2 `org-accounts-auth-context` (スイッチ式認証)
  と unit 3 `profile-transfer` は本テーブルと `AccountKind` 判別を前提とする
- 組織 Account は Account 集約・projection・モデレーション (通報/Suspend/Ban)
  の既存経路にそのまま乗る。Profile の AP actor 型は現行 Person のまま維持
  (Organization actor 型への対応は将来検討、packets.md 残スコープ参照)
- e2e / test_mode の TRUNCATE リスト等の運用面に `organization_members` を
  含める必要がある (Account 従属テーブルとして)

## Links

- [features/org-accounts/overview.md](../features/org-accounts/overview.md)
  「確定設計」(grill Q1-Q11)
- [features/org-accounts/packets.md](../features/org-accounts/packets.md) —
  unit 1 `org-accounts-foundation`
- [interview/2026-08-29-org-accounts-grill.md](../interview/2026-08-29-org-accounts-grill.md)
- Emumet [issue #55](https://github.com/ShuttlePub/Emumet/issues/55) /
  [PR #56](https://github.com/ShuttlePub/Emumet/pull/56)
  (2026-09-01 squash merge `d01d424`)
- 実装参照: kernel/src/entity/organization_membership.rs、
  kernel/src/repository/organization_membership.rs、
  application/src/service/organization/{create,list,membership}.rs、
  server/src/{route,api,schema}/...organization.rs、
  migrations/20260901000001_add_account_kind.sql /
  20260901000002_add_organization_members.sql
