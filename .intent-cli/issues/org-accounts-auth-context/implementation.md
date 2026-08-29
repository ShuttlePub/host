# org-accounts-auth-context Implementation Packet

## Goal

スイッチ式認証を実装する。組織は Kratos identity を持たず、個人が
ログインしたままリクエスト単位で組織コンテキストを指定して操作する。
コンテキスト解決 (ヘッダ → メンバーシップ検証 → org AccountId 主体)、
SessionContext の拡張、組織コンテキストでの Profile 操作経路を提供する。

設計の正源: intents/emumet/features/org-accounts/overview.md「確定設計」
(2026-08-29 grill Q4/Q8、interviews/org-accounts.json)。

## Why

org-accounts grill Q4 でスイッチ式が確定 (組織は Kratos identity を持たない)。
課金主体 (組織) と操作者 (個人メンバー) の分離と一致する方式で、
Ratcap 側のコンテキスト切替 UI (ratcap C1) の前提となる Emumet 側 API 契約。
org-accounts-foundation (メンバーシップ基盤) 完了後の直列 packet。

## Scope

- コンテキスト指定: リクエストヘッダ (仮 X-Organization-Id、utoipa
  security scheme として文書化)。トークン再発行不要のためヘッダ方式
- コンテキスト解決:
  - ヘッダ値 (org nanoid or id) → org Account 存在確認 (404)
  - 要求者の個人 AccountId (auth_emumet_accounts 経由) → organization_members で
    メンバーシップ検証 (非メンバー → 403) + OrgRole 取得
  - 解決結果 (org AccountId + OrgRole) を要求スコープに保持
- SessionContext 拡張 (application/src/service/session_context.rs):
  { auth_account_id, instance_roles, org_context: Option<{ org_account_id, role }> }
  GET /api/v1/me/session-context (仮) で返す
- 組織コンテキストでの主体解決: コンテキスト指定時、操作主体 AccountId を
  org AccountId として解決する経路 (facade 層。既存ハンドラの個人経路は維持)
- 組織コンテキストでの権限判定:
  - Profile 操作: メンバーロール判定 (Member 以上。OrgRole での区別は
    将来の必要に応じて)。Keto account_edit は組織コンテキストでは適用しない
  - メンバー管理等: foundation の OrgRole 判定をそのまま流用
- 組織コンテキストでの Profile 作成・更新 (1 org : 1 Profile 制約のまま。
  2 個目作成は 422。複数化は profile-transfer で部分ユニーク化後)

## Out of scope

- メンバー管理 API 自体 (org-accounts-foundation)
- Profile 移管・組織の複数 Profile (profile-transfer)
- Booskiff 組織 Drive の操作経路 (Booskiff ドメイン側)
- Ratcap UI (ratcap C1 で別途 grill)
- Keto Organization namespace (DB 直接判定のまま)
- AP 連合 (組織コンテキストはローカル API のみ)

## Verification

- ハンドラ/ユースケース単体テスト: コンテキスト未指定 (個人として現行通り)、
  所属 org 指定 (org 主体で解決)、非所属 org 指定 (403)、非存在 org (404)、
  組織 Profile 作成 (org AccountId 所有)・2 個目作成拒否 (422)
- 既存テスト全緑 (後方互換。コンテキスト未指定の経路に一切の挙動変化なし)
- `git diff --check`

## Knowledge Maintenance (G461, optional)

- Intent placement: intents/emumet/features/org-accounts/overview.md (primary) +
  packets.md unit 2
- ADR candidate: intents/emumet/decisions/0007-organization-accounts.md へ追記 —
  コンテキスト解決形状 (ヘッダ方式・主体解決フロー)
- Diagram candidate: none (必要ならコンテキスト解決フローのシーケンス図は
  ADR 内で簡潔に)
- Docs update: none (API 契約の詳細は utoipa/OpenAPI 出力が正源)
- Closeout learning: コンテキスト解決の実装形状確定値 → write_back_required: true

- Guide reachability (G645): REST API (コンテキスト対応エンドポイント) を
  implementation-loop / implementation ロールとして追加 (packet.yaml 参照)。

`improve` (G456 / G460) is the later safety net; packet-time maintenance is the normal path.
