# org-accounts-foundation Implementation Packet

## Goal

組織 Account の基盤を実装する。Account に kind 判別 (personal /
organization) を導入し、認証済み個人が組織 Account を作成し、メンバー
(3段階ロール: Owner / Admin / Member) を管理できるようにする。
メンバーシップは CRUD 永続化 (AuthAccount と同型) とし、組織ロールの
判定はメンバーシップテーブルの直接クエリで行う。

設計の正源: intents/emumet/features/org-accounts/overview.md「確定設計」
(2026-08-29 grill Q1/Q3/Q5、interviews/org-accounts.json)。

## Why

org-accounts (emumet C5) が 2026-08-29 の grill (Q1-Q11) で設計確定した。
Booskiff (組織 Drive)・Ratcap (組織 UI) の前提になる Emumet 先行の基盤で、
auth-context / profile-transfer 各 packet の依存先。現行コードには
organization/member/membership/invite に相当するものが一切存在しない
(調査済み) ので全て新規実装。

## Scope

- ドメイン (kernel):
  - AccountKind enum (Personal | Organization) + Account への kind フィールド追加
  - AccountEvent::Created に kind 追加 (serde デフォルト Personal、旧イベント後方互換)
  - OrganizationMembership エンティティ { org_account_id, member_account_id, role, invited_by, created_at }
  - OrgRole enum (Owner | Admin | Member)
  - Membership CRUD repository port (kernel/src/repository) + Postgres 実装 (driver/src/database/postgres)
  - AccountReadModel に kind + 組織関連クエリ追加 (find_by_id_with_kind 等)
- migration:
  - accounts テーブルに kind 列追加 + 既存レコード 'personal' backfill
  - organization_members テーブル新設 (PK(org_account_id, member_account_id)、role CHECK、created_at)
- use case (application/src/service/organization/ 仮):
  - CreateOrganizationUseCase: 認証者の個人 Account 解決 → 組織 Account 作成 (kind=Organization)
    → 作成者の Owner メンバーシップ作成 (同一 DB tx)
  - InviteMemberUseCase / AcceptInviteUseCase: Owner/Admin が招待 (role 指定)、
    被招待者が承諾してメンバーシップ確定
  - ChangeMemberRoleUseCase (Owner のみ) / RemoveMemberUseCase (Owner/Admin、Owner は不可) /
    LeaveOrganizationUseCase (最後の Owner は不可)
  - ListMyOrganizationsUseCase: 自分の所属組織一覧 + ロール
  - ロール判定は organization_members テーブルの直接クエリ (Keto Organization namespace は新設しない)
- ルート (server/src/route 仮):
  - client: POST /api/v1/organizations、GET /api/v1/organizations/{id}、
    GET /api/v1/organizations/{id}/members、POST .../invites、
    POST .../invites/{invite_id}/accept、PUT .../members/{account_id}/role、
    DELETE .../members/{account_id} (除名/脱退の両義はクエリ or 別パスで整理)、
    GET /api/v1/me/organizations
  - facade: OrgAccountApi (server/src/api/、既存 facade パターン踏襲)
  - エラーマッピング: 共有 ErrorStatus マッピング (403/404/422/400)

## Out of scope

- 認証コンテキスト切替 (org-accounts-auth-context packet)
- Profile 移管 (profile-transfer packet)。なお profiles.account_id の UNIQUE
  制約は現行のまま (個人 1:1 維持)。組織の複数 Profile 許可 (部分ユニーク化) は
  profile-transfer で扱う
- 組織コンテキストでの Profile 作成・操作 API (auth-context で対応)
- AP 連合での組織表現 (Person actor のまま)、リモートメンバー
- 組織の課金・容量
- モデレーション (Warning イベントは moderation-warning-event packet)
- Keto Organization namespace (組織ロールは DB 直接判定が確定)

## Verification

- ユースケース単体テスト (mock repo): 組織作成 (メンバーシップ同時作成)・
  招待→承諾フロー・ロール変更 (Owner のみ許可)・除名 (Owner 不可)・
  脱退 (最後の Owner 不可)・非メンバーからの操作拒否 (403)
- repository 統合テスト (test-support DB): organization_members CRUD 冪等性
- migration の適用・ロールバック (sqlx migrate 実行確認)
- 既存テスト全緑 (Account::create 周辺の回帰なし)
- `git diff --check`

## Knowledge Maintenance (G461, optional)

Captured while the design context is fresh. Answer or explicitly decline:

- Intent placement: intents/emumet/features/org-accounts/overview.md (primary) +
  packets.md unit 1。新規ノード不要
- ADR candidate: intents/emumet/decisions/0007-organization-accounts.md 新設 —
  Account kind 判別 + メンバーシップ CRUD + 組織ロール DB 直接判定 (Keto 非拡張)
- Diagram candidate: none (テーブル/イベントの追加で概念図の変更なし)
- Docs update: none (user-facing docs は Ratcap/Booskiff 側)
- Closeout learning: メンバーシップ CRUD パターン確定値 + AccountEvent kind 後方互換の
  実扱い → write_back_required: true (ADR 0007 + packets.md)

- Guide reachability (G645): REST API (/api/v1/organizations*, /api/v1/me/organizations) を
  implementation-loop / implementation ロールとして追加 (packet.yaml 参照)。

`improve` (G456 / G460) is the later safety net; packet-time maintenance is the normal path.
