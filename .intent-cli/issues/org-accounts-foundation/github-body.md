# org-accounts-foundation: 組織 Account 基盤 — Account 種別 (personal/organization) + 組織作成 + メンバーシップ 3段階ロール (Owner/Admin/Member)

## Goal

認証済み個人が組織 Account を作成し、メンバー (Owner / Admin / Member の
3段階ロール) を管理できる基盤を実装する。Account に kind 判別
(personal / organization) を導入し、メンバーシップの CRUD・招待フロー・
所属組織一覧の REST API を新設する。

## Why This Slice Exists Now

org-accounts (emumet C5) が 2026-08-29 の grill (Q1-Q11) で設計確定
(emumet C5 解消)。Booskiff (組織 Drive)・Ratcap (組織 UI) の前提となる
Emumet 先行の基盤であり、同一 feature の後続 packet
(org-accounts-auth-context / profile-transfer) の依存先。
設計の正源: host リポ intents/emumet の
features/org-accounts/overview.md「確定設計」と
interview/2026-08-29-org-accounts-grill.md。

## Current Observed State

- Account には kind/type 判別が存在しない (kernel/src/entity/account.rs。
  フィールドは id/name/is_bot/status/deleted_at/version/nanoid/created_at)
- AccountEvent: Created / Updated / Deactivated / Suspended / Unsuspended /
  Banned / Unbanned / Reactivated (8 バリアント)
- accounts テーブルに kind 列なし (migrations/20230707210300_init.sql)
- organization / member / membership / invite に相当するコード・テーブル・
  Keto namespace は一切存在しない (コードベース全体でヒット 0)
- Account↔AuthAccount は auth_emumet_accounts 結合テーブルで管理。
  1 AuthAccount が複数 Account を持てる (find_by_auth_id → Vec<Account>)

## Accepted Baseline You May Assume

- 対象ユースケースは「組織としての公式アカウント運用」。個人 Profile の
  共同運用は Non-goal (grill Q1)
- メンバーロールは 3段階: Owner (所有・解散・オーナー移譲) / Admin
  (メンバー管理・Profile 操作) / Member (Profile 操作のみ) (grill Q3)
- 認証済み個人なら誰でも組織を作成可能、1人が複数組織を作成可。
  作成者が最初のオーナー (grill Q5)
- 組織ロールの判定は organization_members テーブルの直接クエリで行う。
  Keto Organization namespace は新設しない (実装判断: メンバーシップの
  変更頻度に対し Keto 同期コストが見合わない。将来連合で必要になったら再検討)
- メンバーシップは CRUD 永続化 (AuthAccount CRUD 移行と同型)。ES 化は
  将来の連合要件時に検討
- 組織の解散は既存 Account 削除フローに準ずる (本 packet では作成・管理のみ。
  解散は既存 DELETE /accounts/{id} の適用でよい)
- profiles.account_id の UNIQUE 制約は現行のまま維持 (個人 1:1)。
  組織の複数 Profile 許可は profile-transfer packet で扱う

## Target Repo / Path / Part

Repository: `ShuttlePub/Emumet`

Target paths: `kernel/src/entity, kernel/src/repository, kernel/src/read_model, application/src/service, server/src/route, server/src/api, driver/src/database/postgres, migrations`

Target part: Account kind 判別 + OrganizationMembership エンティティ/テーブル/CRUD repository + 組織作成・招待・ロール管理 use case + REST API (client)

## In Scope

- AccountKind enum (Personal | Organization)、Account への kind 追加、
  AccountEvent::Created への kind 追加 (serde デフォルト Personal で後方互換)
- organization_members テーブル + OrganizationMembership エンティティ
  (OrgRole: Owner/Admin/Member) + CRUD repository (port + Postgres 実装)
- use case: 組織作成 (作成者 Owner 化) / 招待 / 承諾 / ロール変更 /
  除名 / 脱退 / 所属組織一覧
- ルート: POST /api/v1/organizations (仮) ほかメンバー管理 API、
  GET /api/v1/me/organizations (仮)。facade OrgAccountApi 新設
- accounts.kind 列 migration (既存レコード 'personal' backfill)

## Out Of Scope

- 認証コンテキスト切替 (org-accounts-auth-context packet)
- Profile 移管・組織の複数 Profile (profile-transfer packet)
- 組織コンテキストでの Profile 操作 API (auth-context で対応)
- AP 連合・リモートメンバー・組織 actor 型
- 課金・容量、モデレーション (Warning は moderation-warning-event packet)
- Keto Organization namespace

## Standalone Child Issue Contract

この PR は、Emumet に組織 Account の基盤を導入するものである:
(1) Account に personal/organization の kind 判別を追加し、
(2) organization_members テーブルと CRUD 基盤を新設し、
(3) 認証済みユーザーが組織を作成 (作成者が最初のオーナー) し、
メンバー (Owner/Admin/Member) を招待・承諾・ロール変更・除名・脱退する
client REST API を提供し、(4) 自分の所属組織一覧 API を提供する。
認証コンテキスト切替・Profile 移管・AP 連合は含まない。

## Acceptance Criteria

- accounts テーブルに kind テキスト列 ('personal' | 'organization') が追加され、
  既存レコードは 'personal' に backfill される migration がある
- AccountEvent::Created に kind が追加され、kind なしの旧イベントは
  'personal' としてデシリアライズできる (後方互換)
- kind=personal の Account を organization に変えるコード経路は存在しない
- POST /api/v1/organizations (仮) で組織作成でき、作成者の Owner メンバーシップが
  同時に作成される
- Owner/Admin がメンバー招待 (role 指定) を作成でき、被招待者の承諾でメンバーシップ確定
- ロール変更は Owner のみ。除名は Owner/Admin (Owner 不可)。脱退は本人
  (最後の Owner は不可 → 422)
- GET /api/v1/me/organizations (仮) で所属組織一覧 + 自分のロールが取得できる
- メンバーシップは organization_members テーブルに CRUD 永続化され、
  repository port + Postgres 実装 + read model が存在する
- 非メンバーのメンバー管理操作は 403、存在しない組織/メンバーは 404
- ユースケース単体テストで上記フローが検証され、既存テストが全緑

## Verification

- ユースケース単体テスト (mock repo/権限): 作成・招待→承諾・ロール変更・
  除名・脱退・権限拒否
- repository 統合テスト (test-support): CRUD 冪等性
- migration 適用・ロールバック確認 (sqlx migrate)
- 既存テスト全緑、`git diff --check`

## Related Links

- 設計: host リポ `intents/emumet/features/org-accounts/overview.md` (確定設計)、
  `intents/emumet/interview/2026-08-29-org-accounts-grill.md` (Q1-Q11)
- durable Q/A: host リポ `intents/emumet/interviews/org-accounts.json`
- packet: `.intent-cli/issues/org-accounts-foundation/`
- 依存 feature: account-management (Account aggregate 基盤、完了済み)

## Knowledge Maintenance

- Intent placement: intents/emumet/features/org-accounts/overview.md (primary)、
  features/org-accounts/packets.md unit 1 へ完了リンク追記
- ADR candidate: intents/emumet/decisions/0007-organization-accounts.md 新設
  (Account kind + メンバーシップ CRUD + 組織ロール DB 直接判定)
- Diagram candidate: none
- Docs update: none
- Closeout writeback expected: yes (ADR 0007 + packets.md)

## Guide Reachability (G645)

role-facing surface: REST API (/api/v1/organizations*, /api/v1/me/organizations)。
guide surface: guide workflow task implementation-loop、role: implementation。

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open all child PRs against `main` directly.
