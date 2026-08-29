# org-accounts-auth-context: スイッチ式認証 — 個人 identity のまま組織コンテキストを指定して操作

## Goal

組織は Kratos/Ory identity を持たず、認証済み個人がログインしたまま
リクエスト単位で組織コンテキストを指定して操作できるようにする。
コンテキスト解決 (ヘッダ → org 存在確認 → メンバーシップ検証 → org AccountId
主体)、SessionContext の拡張、組織コンテキストでの Profile 作成・更新を
実装する。

## Why This Slice Exists Now

org-accounts grill Q4 (2026-08-29) でスイッチ式認証が確定。課金主体
(組織) と操作者 (個人メンバー) の分離と一致し、Ratcap の組織コンテキスト
切替 UI (ratcap C1) の前提となる Emumet 側 API 契約。
依存の org-accounts-foundation (メンバーシップ基盤) 完了後の packet。

## Current Observed State

- AuthClaims は {iss, sub, aud, exp} のみ (server/src/auth.rs)。組織
  コンテキストの保持場所が存在しない
- 主体解決は OidcAuthInfo → resolve_auth_account_id → AuthAccountId →
  auth_emumet_accounts → 個人 AccountId の固定経路 (server/src/api/mod.rs)
- SessionContext は { auth_account_id, instance_roles } のみ
  (application/src/service/session_context.rs)
- Profile 更新は account_edit (Keto) 権限チェック
  (application/src/service/account_detail/update.rs)
- org-accounts-foundation で organization_members テーブル + OrgRole
  (Owner/Admin/Member) + CRUD repo が作成済み (本 packet の前提)

## Accepted Baseline You May Assume

- コンテキストの持ち方はリクエストヘッダ (仮 X-Organization-Id)。
  トークンに組織 claim を載せない (Hydra 発行トークンは変更不要のため)
- 組織コンテキストの認可は organization_members テーブルの直接クエリ
  (Keto Organization namespace は新設しない、foundation で確定)
- 1 組織 1 Profile 制約は現行維持 (profiles.account_id UNIQUE のまま)。
  複数化は profile-transfer packet で部分ユニーク化する
- コンテキスト未指定のリクエストは現行通り純粋に個人として動作する
  (後方互換が絶対条件)
- AP 連合への影響なし (組織コンテキストはローカル REST API のみ)

## Target Repo / Path / Part

Repository: `ShuttlePub/Emumet`

Target paths: `server/src/auth.rs, server/src/api, server/src/route, application/src/service, application/src/permission.rs`

Target part: 組織コンテキストの解決 (ヘッダ→メンバーシップ検証→主体 AccountId 解決) + SessionContext 拡張 + 組織コンテキストでの Profile 操作経路

## In Scope

- コンテキストヘッダの受け取りと解決 (org 存在 404 / メンバーシップ 403)
- SessionContext への org_context 追加 + GET /api/v1/me/session-context (仮)
- 組織コンテキストでの操作主体 (org AccountId) 解決経路
- 組織コンテキストでの Profile 作成・更新 (メンバーロール判定。
  1 org : 1 Profile 制約維持)
- foundation の OrgRole 判定を組織コンテキストでも流用

## Out Of Scope

- メンバー管理 API (org-accounts-foundation)
- Profile 移管・組織の複数 Profile (profile-transfer)
- Booskiff 組織 Drive 経路、Ratcap UI
- Keto Organization namespace、AP 連合

## Standalone Child Issue Contract

この PR は、Emumet の認証に「組織コンテキスト」を導入するものである:
認証済み個人が、リクエストヘッダで組織を指定すると、その組織のメンバー
として操作主体が解決され (メンバーシップ検証 + ロール判定)、組織所有の
Profile を作成・更新できる。ヘッダ未指定のリクエストは現行通り個人として
動作する (後方互換)。メンバー管理・Profile 移管は含まない。

## Acceptance Criteria

- コンテキスト未指定は現行動作のまま (既存テスト全緑)
- ヘッダで org を指定すると org 存在確認 (404) → メンバーシップ検証
  (非メンバー 403) → org AccountId + OrgRole が解決される
- SessionContext に org_context が含まれ、セッションコンテキスト API で取得できる
- 組織コンテキストで Profile 作成が org AccountId 所有で記録され、
  2 個目作成は 422
- 組織コンテキストで Profile 更新がメンバーロール判定で許可される
- 単体テストで未指定/所属/非所属/非存在の4経路が検証される

## Verification

- ハンドラ/ユースケース単体テスト (4経路 + Profile 作成/更新)
- 既存テスト全緑、`git diff --check`

## Related Links

- 設計: host リポ `intents/emumet/features/org-accounts/overview.md`、
  `intents/emumet/interview/2026-08-29-org-accounts-grill.md` (Q4/Q8)
- 前提 packet: `.intent-cli/issues/org-accounts-foundation/`
- Ratcap 側 UI 論点: host リポ `intents/ratcap/clarifications/open.md` C1

## Knowledge Maintenance

- Intent placement: overview.md (primary)、packets.md unit 2 へ完了リンク追記
- ADR candidate: 0007-organization-accounts.md へコンテキスト解決形状を追記
- Diagram candidate: none
- Docs update: none
- Closeout writeback expected: yes

## Guide Reachability (G645)

role-facing surface: REST API (組織コンテキスト対応エンドポイント)。
guide surface: implementation-loop、role: implementation。

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open all child PRs against `main` directly.
